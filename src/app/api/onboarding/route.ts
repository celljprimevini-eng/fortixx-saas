import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { check, getClientIp } from '@/lib/rate-limit';
import { onboardingSchema } from '@/lib/validation/schemas';

/**
 * POST /api/onboarding — provisiona user + tenant + profile atomicamente.
 *
 * Acesso: admin do tenant fundador (Fortixx). Use depois que o Stripe
 * confirma um pagamento — chama esta rota para criar a conta do novo
 * cliente com role=admin.
 *
 * Substitui `auth.admin.createUser` (que rejeita service_role v2 nesta
 * instância) pela RPC `provision_user_tenant` no Postgres. Vantagens:
 * - bcrypt hash feito no próprio Postgres (sem npm bcrypt)
 * - atomicidade (falha = nada fica inconsistente)
 * - trigger `handle_new_user` roda com search_path correto
 * - rearrange automático de tenant quando `existing_tenant_id` é passado
 *
 * Rate limit: 10 req/min por IP — provisioning não é volatil.
 *
 * Resposta 200 OK:
 *   { user_id, tenant_id, email, role }
 * Resposta 401: caller não é admin
 * Resposta 403: tenant_id não pertence ao caller
 * Resposta 429: rate limit
 * Resposta 500: Postgres RPC falhou
 */
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  // 1. Validação do caller (deve ser admin do tenant fundador)
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });
  }
  if (profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Acesso restrito a administradores.' },
      { status: 403 }
    );
  }

  // 2. Rate limit por IP+caller_id
  const ip = getClientIp(req.headers);
  const key = `onboarding:${ip}:${user.id}`;
  const limit = check(key, RATE_LIMIT, WINDOW_MS);
  if (!limit.ok) {
    const retryAfter = Math.ceil(limit.resetMs / 1000);
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // 3. Parse + validação de input (fail-closed)
  const raw = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const { email, password, full_name, company_name, existing_tenant_id, role } = parsed.data;

  // 4. Se existing_tenant_id foi passado, verifica que caller é admin DELE
  // (impede que admin de tenant A crie user em tenant B)
  if (existing_tenant_id && existing_tenant_id !== profile.tenant_id) {
    return NextResponse.json(
      { error: 'Você só pode provisionar usuários para o seu próprio tenant.' },
      { status: 403 }
    );
  }

  // 5. Chama RPC via service_role (bypassa RLS).
  //    A RPC provision_user_tenant não está nos tipos gerados de Database
  //    (precisaria rodar `supabase gen types` com a CLI instalada). Tipo
  //    declarado inline pra evitar cast perigoso.
  type ProvisionResult = {
    user_id: string;
    tenant_id: string;
    email: string;
    role: 'admin' | 'rh' | 'gestor' | 'colaborador';
  };
  type AdminClient = {
    rpc(fn: 'provision_user_tenant', params: {
      p_email: string;
      p_password: string;
      p_full_name: string;
      p_company_name: string | null;
      p_existing_tenant_id: string | null;
      p_role: ProvisionResult['role'];
    }): Promise<{ data: ProvisionResult[] | null; error: { message: string } | null }>;
  };
  const admin = createAdminClient() as unknown as AdminClient;
  const { data, error: rpcError } = await admin.rpc('provision_user_tenant', {
    p_email: email,
    p_password: password,
    p_full_name: full_name,
    p_company_name: company_name || null,
    p_existing_tenant_id: existing_tenant_id || null,
    p_role: role,
  });

  if (rpcError || !data || data.length === 0) {
    console.error(
      `[onboarding] failed email=${email} actor=${user.id} ip=${ip} error=${rpcError?.message ?? 'empty result'}`
    );
    return NextResponse.json(
      { error: 'Falha ao provisionar conta. Veja os logs do servidor.' },
      { status: 500 }
    );
  }

  const created = data[0];
  console.log(
    `[onboarding] ok user_id=${created.user_id} tenant_id=${created.tenant_id} role=${created.role} actor=${user.id}`
  );

  return NextResponse.json({
    success: true,
    user_id: created.user_id,
    tenant_id: created.tenant_id,
    email: created.email,
    role: created.role,
  });
}
