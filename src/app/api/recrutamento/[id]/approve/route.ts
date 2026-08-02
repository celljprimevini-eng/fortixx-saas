import { NextRequest, NextResponse } from 'next/server';
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
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
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
    .eq('id', params.id)
    .eq('tenant_id', actingProfile.tenant_id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  }

  // 1) Marca o candidato como aprovado
  await admin.from('candidates').update({ stage: 'aprovado' }).eq('id', candidate.id);

  // 2) Cria o acesso (usuário no Supabase Auth) com senha temporária
  const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
    email: candidate.email,
    email_confirm: true,
    user_metadata: { full_name: candidate.full_name },
  });
  if (createUserError || !newUser.user) {
    return NextResponse.json({ error: 'Falha ao criar acesso do colaborador.' }, { status: 500 });
  }

  // 3) Cria o profile vinculado ao MESMO tenant (não cria empresa nova aqui —
  //    diferente do signup inicial, que cria tenant + admin)
  await admin.from('profiles').insert({
    id: newUser.user.id,
    tenant_id: actingProfile.tenant_id,
    full_name: candidate.full_name,
    email: candidate.email,
    role: 'colaborador',
    job_title: (candidate.job_openings as any)?.title,
    department_id: (candidate.job_openings as any)?.department_id,
  });

  // 4) Inicia o onboarding com checklist padrão
  const { data: onboarding } = await admin
    .from('onboardings')
    .insert({ tenant_id: actingProfile.tenant_id, profile_id: newUser.user.id, candidate_id: candidate.id })
    .select()
    .single();

  const defaultTasks = [
    'Assinar contrato digital',
    'Enviar documentos (RG, CPF, comprovante)',
    'Receber equipamentos',
    'Configurar acessos de sistema',
    'Reunião com gestor direto',
  ];
  await admin.from('onboarding_tasks').insert(
    defaultTasks.map((title, i) => ({ onboarding_id: onboarding!.id, title, order_index: i }))
  );

  // 5) Gera link de definição de senha e envia e-mail automático
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: candidate.email,
  });

  const template = candidateApprovedEmail(
    candidate.full_name,
    linkData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`
  );
  await sendEmail({ to: candidate.email, ...template });

  return NextResponse.json({ success: true, profile_id: newUser.user.id });
}
