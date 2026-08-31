import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Contraparte de approve/route.ts: recusa um candidato no Kanban de
 * Aprovações. Não cria usuário nem dispara e-mail — só marca
 * candidates.stage = 'reprovado'. Mesma checagem de auth+role+tenant do
 * approve, pra manter o mesmo nível de proteção.
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
    return NextResponse.json({ error: 'Sem permissão para recusar candidatos.' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: candidate } = await admin
    .from('candidates')
    .select('id')
    .eq('id', params.id)
    .eq('tenant_id', actingProfile.tenant_id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  }

  await admin.from('candidates').update({ stage: 'reprovado' }).eq('id', candidate.id);

  return NextResponse.json({ success: true });
}
