import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Marca/desmarca uma tarefa de onboarding (checkbox do checklist em
 * Onboarding > Checklist). Segue o mesmo padrão de auth de
 * api/recrutamento/[id]/approve: exige usuário logado com role admin/rh no
 * MESMO tenant do onboarding dono da tarefa — quem gerencia o checklist é o
 * time de RH, não o próprio colaborador em onboarding (que ainda nem tem
 * necessariamente acesso à Plataforma de RH).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: actingProfile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!actingProfile || !['admin', 'rh'].includes(actingProfile.role)) {
    return NextResponse.json({ error: 'Sem permissão para atualizar tarefas de onboarding.' }, { status: 403 });
  }

  let body: { done?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (typeof body.done !== 'boolean') {
    return NextResponse.json({ error: '"done" precisa ser boolean.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirma que a task pertence a um onboarding do MESMO tenant do caller,
  // via join onboarding_tasks -> onboardings.
  const { data: task } = await admin
    .from('onboarding_tasks')
    .select('id, onboarding_id, onboardings!inner(tenant_id)')
    .eq('id', params.id)
    .single();

  const taskTenantId = (task as any)?.onboardings?.tenant_id
    ?? (Array.isArray((task as any)?.onboardings) ? (task as any).onboardings[0]?.tenant_id : undefined);

  if (!task || taskTenantId !== actingProfile.tenant_id) {
    return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
  }

  const { error } = await admin
    .from('onboarding_tasks')
    .update({ done: body.done, done_at: body.done ? new Date().toISOString() : null })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Falha ao atualizar tarefa.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
