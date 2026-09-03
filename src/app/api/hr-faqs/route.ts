import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hrFaqCreateSchema } from '@/lib/validation/schemas';

/**
 * POST /api/hr-faqs — adiciona uma pergunta à base de conhecimento do
 * Assistente RH (Assistente RH › FAQ inteligente, botão "+ Nova pergunta").
 * A base alimenta tanto a listagem quanto o matcher do assistente.
 * Exige role admin/rh (tabela hr_faqs, policy hr_faqs_write_admin_rh).
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
    return NextResponse.json({ error: 'Sem permissão para editar a base de FAQ.' }, { status: 403 });
  }

  const parsed = hrFaqCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from('hr_faqs')
    .insert({
      tenant_id: profile.tenant_id,
      question: parsed.data.question,
      answer: parsed.data.answer,
      views: 0,
    })
    .select('id, question, answer, views')
    .single();

  if (error || !created) {
    return NextResponse.json({ error: 'Falha ao adicionar a pergunta.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, faq: created });
}
