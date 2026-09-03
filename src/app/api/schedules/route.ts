import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleCreateSchema } from '@/lib/validation/schemas';

/**
 * POST /api/schedules — cadastra um turno na escala (Colaboradores › Escalas
 * & Presença, botão "+ Cadastrar escala"). Exige role admin/rh/gestor.
 * `schedules` tem unique(profile_id, shift_date) — dia duplicado vira 409.
 */
const SHIFT_TIMES: Record<string, [string | null, string | null]> = {
  manha: ['06:00', '14:00'],
  tarde: ['14:00', '22:00'],
  noite: ['22:00', '06:00'],
  folga: [null, null],
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: acting } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();
  if (!acting || !['admin', 'rh', 'gestor'].includes(acting.role)) {
    return NextResponse.json({ error: 'Sem permissão para cadastrar escala.' }, { status: 403 });
  }

  const parsed = scheduleCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { profile_id, shift_date, shift_type } = parsed.data;

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profile_id)
    .eq('tenant_id', acting.tenant_id)
    .single();
  if (!target) return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 });

  const [start_time, end_time] = SHIFT_TIMES[shift_type] ?? [null, null];

  const { data: created, error } = await admin
    .from('schedules')
    .insert({
      tenant_id: acting.tenant_id,
      profile_id,
      shift_date,
      shift_type,
      start_time,
      end_time,
      status: 'scheduled',
      created_by: user.id,
    })
    .select('id, shift_date, shift_type, status')
    .single();

  if (error) {
    const conflict = error.code === '23505';
    return NextResponse.json(
      { error: conflict ? 'Esse colaborador já tem turno nesse dia.' : 'Falha ao cadastrar escala.' },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ success: true, schedule: created });
}
