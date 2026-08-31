import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { interviewUpdateSchema } from '@/lib/validation/schemas';

/**
 * PATCH /api/interviews/[id] — atualiza status (realizada/cancelada/
 * reagendada) e/ou notes de uma entrevista. Mesmo padrão de auth de
 * api/onboarding-tasks/[id]: exige role admin/rh no MESMO tenant da
 * entrevista.
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
    return NextResponse.json({ error: 'Sem permissão para atualizar entrevistas.' }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = interviewUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: interview } = await admin
    .from('interviews')
    .select('id, tenant_id')
    .eq('id', params.id)
    .single();

  if (!interview || interview.tenant_id !== actingProfile.tenant_id) {
    return NextResponse.json({ error: 'Entrevista não encontrada.' }, { status: 404 });
  }

  const update: { status?: 'agendada' | 'realizada' | 'cancelada' | 'reagendada'; notes?: string | null } = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes || null;

  const { error } = await admin
    .from('interviews')
    .update(update)
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Falha ao atualizar entrevista.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
