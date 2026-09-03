import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { trainingCreateSchema } from '@/lib/validation/schemas';

/**
 * Onboarding > Treinamentos (subview "onb-treinamentos"). Antes eram 3
 * cards de progresso fixos no protótipo — agora lê o catálogo real
 * `trainings` + progresso agregado de `training_progress`
 * (supabase/migrations/0010_trainings.sql).
 *
 * GET — lista treinamentos do tenant com quantos colaboradores completaram
 * (progress_pct = 100) / total de colaboradores com progresso registrado.
 * Só leitura nesta passada — criar treinamento fica pra depois.
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

  const { data: trainings, error: trainingsError } = await supabase
    .from('trainings')
    .select('id, title, description, created_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  if (trainingsError) {
    return NextResponse.json({ error: 'Falha ao buscar treinamentos.' }, { status: 500 });
  }

  if (!trainings || trainings.length === 0) {
    return NextResponse.json({ trainings: [] });
  }

  const { data: progress, error: progressError } = await supabase
    .from('training_progress')
    .select('training_id, profile_id, progress_pct, completed_at')
    .eq('tenant_id', profile.tenant_id)
    .in('training_id', trainings.map((t) => t.id));

  if (progressError) {
    return NextResponse.json({ error: 'Falha ao buscar progresso.' }, { status: 500 });
  }

  const result = trainings.map((t) => {
    const rows = (progress ?? []).filter((p) => p.training_id === t.id);
    const total = rows.length;
    const completed = rows.filter((p) => p.progress_pct >= 100).length;
    const avgPct = total > 0 ? Math.round(rows.reduce((sum, p) => sum + p.progress_pct, 0) / total) : 0;
    return { ...t, total_colaboradores: total, completos: completed, progresso_medio: avgPct };
  });

  return NextResponse.json({ trainings: result });
}

/**
 * POST — cria um treinamento no catálogo (Onboarding › Treinamentos,
 * botão "+ Novo treinamento"). Exige role admin/rh (policy
 * trainings_write_admin_rh).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'rh'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão para criar treinamentos.' }, { status: 403 });
  }

  const parsed = trainingCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from('trainings')
    .insert({
      tenant_id: profile.tenant_id,
      title: parsed.data.title,
      description: parsed.data.description || null,
    })
    .select('id, title, description')
    .single();

  if (error || !created) {
    return NextResponse.json({ error: 'Falha ao criar o treinamento.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, training: created });
}
