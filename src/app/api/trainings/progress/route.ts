import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { trainingProgressSchema } from '@/lib/validation/schemas';

/**
 * PATCH /api/trainings/progress — um colaborador atualiza o PRÓPRIO
 * progresso num treinamento. `profile_id` vem do usuário autenticado
 * (nunca do body), pra evitar que alguém atualize o progresso de outra
 * pessoa — igual o comentário pedia. Faz upsert em `training_progress`
 * (unique(training_id, profile_id) garante 1 linha por pessoa/treinamento).
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });

  const raw = await req.json().catch(() => null);
  const parsed = trainingProgressSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { training_id, progress_pct } = parsed.data;

  const admin = createAdminClient();

  // Confirma que o treinamento pertence ao MESMO tenant do caller.
  const { data: training } = await admin
    .from('trainings')
    .select('id')
    .eq('id', training_id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!training) {
    return NextResponse.json({ error: 'Treinamento não encontrado.' }, { status: 404 });
  }

  const { error } = await admin
    .from('training_progress')
    .upsert(
      {
        tenant_id: profile.tenant_id,
        training_id,
        profile_id: user.id,
        progress_pct,
        completed_at: progress_pct >= 100 ? new Date().toISOString() : null,
      },
      { onConflict: 'training_id,profile_id' }
    );

  if (error) {
    return NextResponse.json({ error: 'Falha ao atualizar progresso.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
