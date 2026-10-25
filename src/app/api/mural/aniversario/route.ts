import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, badRequest, serverError } from '@/lib/auth/session';
import { birthDateSchema } from '@/lib/validation/schemas';

/**
 * PATCH { birth_date: 'AAAA-MM-DD' | null } → o colaborador informa (ou
 * apaga) a própria data de nascimento, usada nos aniversariantes do Mural.
 * Pros colegas aparecem só dia e mês.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = birthDateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Data inválida.');

  const bd = parsed.data.birth_date;
  if (bd) {
    const d = new Date(`${bd}T12:00:00Z`);
    const year = d.getUTCFullYear();
    const nowYear = new Date().getUTCFullYear();
    if (Number.isNaN(d.getTime()) || year < nowYear - 100 || year > nowYear - 14) {
      return badRequest('Data de nascimento fora do intervalo válido.');
    }
  }

  const { error } = await createAdminClient().from('profiles').update({ birth_date: bd }).eq('id', profile.id);
  if (error) return serverError();
  return NextResponse.json({ success: true });
}
