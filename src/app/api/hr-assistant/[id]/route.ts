import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hrConversationUpdateSchema } from '@/lib/validation/schemas';

/**
 * PATCH /api/hr-assistant/[id] — muda o status de uma thread do Assistente RH
 * (open / resolved / escalated). Usado pelos botões "Resolver" e "Escalar"
 * das subtabs Histórico / Escalonamento. Exige role admin/rh no MESMO tenant
 * da thread (mesmo padrão de api/interviews/[id]).
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
    return NextResponse.json({ error: 'Sem permissão para atualizar conversas.' }, { status: 403 });
  }

  const parsed = hrConversationUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: conv } = await admin
    .from('hr_conversations')
    .select('id, tenant_id')
    .eq('id', params.id)
    .single();

  if (!conv || conv.tenant_id !== actingProfile.tenant_id) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
  }

  const { error } = await admin
    .from('hr_conversations')
    .update({ status: parsed.data.status })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Falha ao atualizar conversa.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
