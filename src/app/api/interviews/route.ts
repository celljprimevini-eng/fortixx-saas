import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { interviewCreateSchema } from '@/lib/validation/schemas';

/**
 * Recrutamento > Entrevistas (subview "recrut-entrevistas" no dashboard
 * vanilla). Antes era tabela 100% estática — agora lê/escreve na tabela
 * `interviews` real (supabase/migrations/0009_interviews.sql).
 *
 * GET  — lista entrevistas do tenant, com candidato/entrevistador via join.
 * POST — agenda uma nova entrevista. Exige role admin/rh, mesmo padrão de
 *        api/onboarding-tasks/[id] e api/recrutamento/[id]/approve.
 */

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

  // RLS já restringe por tenant_id — usamos o client autenticado (não admin)
  // pra respeitar a policy interviews_select_tenant.
  const { data, error } = await supabase
    .from('interviews')
    .select('id, scheduled_at, status, notes, candidates(id, full_name), job_openings(id, title), profiles:interviewer_id(id, full_name)')
    .eq('tenant_id', profile.tenant_id)
    .order('scheduled_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Falha ao buscar entrevistas.' }, { status: 500 });
  }

  return NextResponse.json({ interviews: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: actingProfile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!actingProfile || !['admin', 'rh'].includes(actingProfile.role)) {
    return NextResponse.json({ error: 'Sem permissão para agendar entrevistas.' }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = interviewCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { candidate_id, job_opening_id, interviewer_id, scheduled_at, notes } = parsed.data;

  const scheduledDate = new Date(scheduled_at);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: 'Data/hora inválida.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirma que o candidato (e a vaga, se informada) pertencem ao MESMO
  // tenant do caller — mesma proteção usada em api/recrutamento/[id]/approve.
  const { data: candidate } = await admin
    .from('candidates')
    .select('id')
    .eq('id', candidate_id)
    .eq('tenant_id', actingProfile.tenant_id)
    .single();
  if (!candidate) {
    return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  }

  if (job_opening_id) {
    const { data: job } = await admin
      .from('job_openings')
      .select('id')
      .eq('id', job_opening_id)
      .eq('tenant_id', actingProfile.tenant_id)
      .single();
    if (!job) {
      return NextResponse.json({ error: 'Vaga não encontrada.' }, { status: 404 });
    }
  }

  if (interviewer_id) {
    const { data: interviewer } = await admin
      .from('profiles')
      .select('id')
      .eq('id', interviewer_id)
      .eq('tenant_id', actingProfile.tenant_id)
      .single();
    if (!interviewer) {
      return NextResponse.json({ error: 'Entrevistador não encontrado.' }, { status: 404 });
    }
  }

  const { data: created, error } = await admin
    .from('interviews')
    .insert({
      tenant_id: actingProfile.tenant_id,
      candidate_id,
      job_opening_id: job_opening_id || null,
      interviewer_id: interviewer_id || null,
      scheduled_at: scheduledDate.toISOString(),
      notes: notes || null,
    })
    .select()
    .single();

  if (error || !created) {
    return NextResponse.json({ error: 'Falha ao agendar entrevista.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, interview: created });
}
