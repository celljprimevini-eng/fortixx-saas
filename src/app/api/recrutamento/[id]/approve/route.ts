import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, candidateApprovedEmail } from '@/lib/resend/client';

/**
 * Este é o coração da automação de recrutamento prometida no front-end:
 * "Quando aprovado: criar colaborador, criar acesso, iniciar onboarding,
 * enviar e-mail automático."
 *
 * Chamada quando RH/Admin move um candidato para o estágio "aprovado"
 * no Kanban de Pipeline.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: actingProfile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!actingProfile || !['admin', 'rh'].includes(actingProfile.role)) {
    return NextResponse.json({ error: 'Sem permissão para aprovar candidatos.' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: candidate } = await admin
    .from('candidates')
    .select('*, job_openings(title, department_id)')
    .eq('id', id)
    .eq('tenant_id', actingProfile.tenant_id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  }

  if (candidate.stage === 'aprovado') {
    return NextResponse.json({ error: 'Candidato já foi aprovado.' }, { status: 409 });
  }

  // 1) Cria o acesso JÁ vinculado ao tenant de quem aprovou, como colaborador.
  //    Antes usava auth.admin.createUser + insert em profiles: o trigger de
  //    signup (handle_new_user) já criava uma empresa nova com o candidato como
  //    ADMIN, o insert do profile falhava por chave duplicada (erro ignorado) e
  //    o aprovado ia parar sozinho, como admin, numa "Minha Empresa". A RPC
  //    provision_user_tenant faz tudo numa transação e move o perfil pro tenant
  //    certo. A senha é aleatória e descartada — o colaborador define a dele
  //    pelo link de recuperação enviado no passo 4.
  type ProvisionResult = { user_id: string; tenant_id: string; email: string; role: string };
  type AdminRpc = {
    rpc(fn: 'provision_user_tenant', params: {
      p_email: string;
      p_password: string;
      p_full_name: string;
      p_company_name: string | null;
      p_existing_tenant_id: string;
      p_role: 'colaborador';
    }): Promise<{ data: ProvisionResult[] | null; error: { message: string } | null }>;
  };
  const { data: provisioned, error: provisionError } = await (admin as unknown as AdminRpc).rpc(
    'provision_user_tenant',
    {
      p_email: candidate.email,
      p_password: `${randomUUID()}${randomUUID()}`,
      p_full_name: candidate.full_name,
      p_company_name: null,
      p_existing_tenant_id: actingProfile.tenant_id,
      p_role: 'colaborador',
    },
  );
  const newUserId = provisioned?.[0]?.user_id;
  if (provisionError || !newUserId) {
    const exists = provisionError?.message.includes('já existe');
    console.error(`[approve] provision falhou candidate=${candidate.id} error=${provisionError?.message}`);
    return NextResponse.json(
      {
        error: exists
          ? 'Já existe um usuário com o e-mail deste candidato.'
          : 'Falha ao criar acesso do colaborador.',
      },
      { status: exists ? 409 : 500 },
    );
  }

  const job = candidate.job_openings as { title?: string | null; department_id?: string | null } | null;
  await admin
    .from('profiles')
    .update({ job_title: job?.title ?? null, department_id: job?.department_id ?? null })
    .eq('id', newUserId);

  // 2) Só marca como aprovado depois que o acesso existe de fato.
  await admin.from('candidates').update({ stage: 'aprovado' }).eq('id', candidate.id);

  // 3) Inicia o onboarding com checklist padrão
  const { data: onboarding } = await admin
    .from('onboardings')
    .insert({ tenant_id: actingProfile.tenant_id, profile_id: newUserId, candidate_id: candidate.id })
    .select()
    .single();

  const defaultTasks = [
    'Assinar contrato digital',
    'Enviar documentos (RG, CPF, comprovante)',
    'Receber equipamentos',
    'Configurar acessos de sistema',
    'Reunião com gestor direto',
  ];
  if (onboarding) {
    await admin.from('onboarding_tasks').insert(
      defaultTasks.map((title, i) => ({ onboarding_id: onboarding.id, title, order_index: i }))
    );
  }

  // 4) Gera link de definição de senha e envia e-mail automático
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: candidate.email,
  });

  const template = candidateApprovedEmail(
    candidate.full_name,
    linkData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`
  );
  // sendEmail nunca lança, mas o generateLink acima pode — o candidato já foi
  // aprovado (user/profile/onboarding criados), então o e-mail é best-effort.
  const emailResult = await sendEmail({ to: candidate.email, ...template });

  return NextResponse.json({
    success: true,
    profile_id: newUserId,
    email_sent: !('skipped' in emailResult || 'error' in emailResult),
  });
}
