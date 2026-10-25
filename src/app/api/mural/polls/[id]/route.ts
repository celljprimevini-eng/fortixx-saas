import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, isHr, badRequest, serverError } from '@/lib/auth/session';
import { pollVoteSchema } from '@/lib/validation/schemas';

/**
 * POST  { option_id } → vota (ou troca o voto) numa enquete aberta.
 * PATCH               → encerra a enquete (autor ou RH/admin).
 */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = pollVoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const db = createAdminClient();
  const { data: poll } = await db
    .from('polls')
    .select('id, closed, closes_at')
    .eq('id', params.id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!poll) return NextResponse.json({ error: 'Enquete não encontrada.' }, { status: 404 });
  if (poll.closed || (poll.closes_at && new Date(poll.closes_at).getTime() < Date.now())) {
    return badRequest('Esta enquete já foi encerrada.');
  }

  const { data: option } = await db
    .from('poll_options')
    .select('id')
    .eq('id', parsed.data.option_id)
    .eq('poll_id', poll.id)
    .single();
  if (!option) return badRequest('Opção inválida.');

  const { error } = await db
    .from('poll_votes')
    .upsert(
      { poll_id: poll.id, option_id: option.id, profile_id: profile.id, tenant_id: profile.tenant_id },
      { onConflict: 'poll_id,profile_id' },
    );
  if (error) return serverError('Falha ao registrar o voto.');
  return NextResponse.json({ success: true });
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const db = createAdminClient();
  const { data: poll } = await db
    .from('polls')
    .select('id, author_id')
    .eq('id', params.id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!poll) return NextResponse.json({ error: 'Enquete não encontrada.' }, { status: 404 });
  if (poll.author_id !== profile.id && !isHr(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão para encerrar.' }, { status: 403 });
  }

  const { error } = await db.from('polls').update({ closed: true }).eq('id', poll.id);
  if (error) return serverError();
  return NextResponse.json({ success: true });
}
