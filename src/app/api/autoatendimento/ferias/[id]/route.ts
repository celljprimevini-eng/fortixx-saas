import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, isHr, badRequest, serverError } from '@/lib/auth/session';
import { leaveDecisionSchema } from '@/lib/validation/schemas';
import { notify } from '@/lib/notify';

/**
 * PATCH { status, decision_note? } num pedido de férias/folga/licença.
 * - approved / rejected: RH/admin, ou o gestor direto do colaborador.
 *   Ninguém decide o próprio pedido.
 * - canceled: só o próprio colaborador, enquanto estiver pendente.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = leaveDecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { status, decision_note } = parsed.data;

  const db = createAdminClient();
  const { data: leave } = await db
    .from('leave_requests')
    .select('id, profile_id, status, kind, start_date, end_date, days')
    .eq('id', params.id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!leave) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  if (leave.status !== 'pending') return badRequest('Este pedido já foi decidido.');

  if (status === 'canceled') {
    if (leave.profile_id !== profile.id) {
      return NextResponse.json({ error: 'Só quem pediu pode cancelar.' }, { status: 403 });
    }
  } else {
    if (leave.profile_id === profile.id) {
      return NextResponse.json({ error: 'Você não pode aprovar o próprio pedido.' }, { status: 403 });
    }
    let allowed = isHr(profile.role);
    if (!allowed && profile.role === 'gestor') {
      const { data: owner } = await db.from('profiles').select('manager_id').eq('id', leave.profile_id).single();
      allowed = owner?.manager_id === profile.id;
    }
    if (!allowed) return NextResponse.json({ error: 'Sem permissão para decidir este pedido.' }, { status: 403 });
  }

  const { error } = await db
    .from('leave_requests')
    .update({
      status,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
      decision_note: decision_note || null,
    })
    .eq('id', leave.id)
    .eq('status', 'pending');
  if (error) return serverError();

  if (status !== 'canceled') {
    const label = leave.kind === 'ferias' ? 'férias' : leave.kind === 'folga' ? 'folga' : 'licença';
    const periodo = `${leave.start_date.split('-').reverse().join('/')} a ${leave.end_date.split('-').reverse().join('/')}`;
    await notify({
      tenantId: profile.tenant_id,
      profileIds: [leave.profile_id],
      category: 'escalas',
      title: status === 'approved' ? `Seu pedido de ${label} foi aprovado ✅` : `Seu pedido de ${label} foi recusado`,
      message: decision_note ? `${periodo} — ${decision_note}` : periodo,
      url: '/dashboard',
    });
  }
  return NextResponse.json({ success: true, status });
}
