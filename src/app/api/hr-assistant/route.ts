import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hrAssistantMessageSchema } from '@/lib/validation/schemas';
import { askHrAssistant } from '@/lib/hr-assistant/responder';

/**
 * Assistente RH (view "view-assistente" no dashboard vanilla).
 *
 * GET  — lista as threads de atendimento do tenant (Histórico / Escalonamento).
 *        Colaborador vê só as próprias; admin/rh/gestor veem todas (RLS).
 * POST — colaborador manda uma pergunta. Cria a thread se `conversation_id`
 *        não vier, grava a mensagem, chama a Claude API com a base de FAQ do
 *        tenant, grava a resposta e devolve. Se a resposta indicar
 *        escalonamento, a thread vira status='escalated'.
 *
 * Funciona sem nenhuma chave: por padrão casa a pergunta com a base `hr_faqs`
 * do tenant (modo grátis). Se `ANTHROPIC_API_KEY` existir, usa a Claude API
 * como upgrade — ver src/lib/hr-assistant/responder.ts.
 */

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });

  // RLS (hr_conversations_select) já restringe por tenant e por dono/role.
  const { data, error } = await supabase
    .from('hr_conversations')
    .select('id, subject, status, last_message_at, created_at, profiles:profile_id(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Falha ao buscar conversas.' }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });

  const parsed = hrAssistantMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { conversation_id, message } = parsed.data;

  const admin = createAdminClient();
  const tenantId = profile.tenant_id;

  // Resolve (ou cria) a thread. Se veio conversation_id, confirma que é do
  // mesmo tenant e do próprio colaborador — mesma proteção de tenant-scoping
  // das outras rotas.
  let conversationId = conversation_id ?? null;
  let history: { role: 'user' | 'assistant'; body: string }[] = [];

  if (conversationId) {
    const { data: conv } = await admin
      .from('hr_conversations')
      .select('id, tenant_id, profile_id')
      .eq('id', conversationId)
      .single();
    if (!conv || conv.tenant_id !== tenantId || conv.profile_id !== user.id) {
      return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
    }
    const { data: prev } = await admin
      .from('hr_messages')
      .select('role, body')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);
    history = (prev ?? []) as { role: 'user' | 'assistant'; body: string }[];
  } else {
    const { data: created, error: createErr } = await admin
      .from('hr_conversations')
      .insert({
        tenant_id: tenantId,
        profile_id: user.id,
        subject: message.slice(0, 80),
      })
      .select('id')
      .single();
    if (createErr || !created) {
      return NextResponse.json({ error: 'Falha ao abrir conversa.' }, { status: 500 });
    }
    conversationId = created.id;
  }

  await admin.from('hr_messages').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    role: 'user',
    body: message,
  });

  // Base de conhecimento do tenant + nome da empresa pro contexto do modelo.
  const [{ data: faqs }, { data: tenant }] = await Promise.all([
    admin.from('hr_faqs').select('question, answer').eq('tenant_id', tenantId).limit(100),
    admin.from('tenants').select('name').eq('id', tenantId).single(),
  ]);

  // askHrAssistant nunca lança por configuração: sem ANTHROPIC_API_KEY usa a
  // base de FAQ (modo grátis), e se a IA falhar cai no FAQ também.
  const reply = await askHrAssistant({
    companyName: tenant?.name ?? 'sua empresa',
    faqs: faqs ?? [],
    history,
    message,
  });

  await admin.from('hr_messages').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    role: 'assistant',
    body: reply.answer,
  });

  await admin
    .from('hr_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      status: reply.escalate ? 'escalated' : 'open',
    })
    .eq('id', conversationId);

  return NextResponse.json({
    conversation_id: conversationId,
    answer: reply.answer,
    escalated: reply.escalate,
  });
}
