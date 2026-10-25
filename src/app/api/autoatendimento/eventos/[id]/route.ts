import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, isHr, badRequest, serverError } from '@/lib/auth/session';

/**
 * POST   → inscreve / desinscreve o usuário no evento (toggle), respeitando
 *          a capacidade.
 * DELETE → apaga o evento (RH/admin).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;
  const db = createAdminClient();

  const { data: ev } = await db
    .from('events')
    .select('id, capacity, starts_at, ends_at')
    .eq('id', params.id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!ev) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });

  const { data: mine } = await db
    .from('event_registrations')
    .select('event_id')
    .eq('event_id', ev.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (mine) {
    await db.from('event_registrations').delete().eq('event_id', ev.id).eq('profile_id', profile.id);
    return NextResponse.json({ success: true, registered: false });
  }

  if (new Date(ev.ends_at ?? ev.starts_at).getTime() < Date.now()) {
    return badRequest('Este evento já aconteceu.');
  }
  if (ev.capacity != null) {
    const { count } = await db
      .from('event_registrations')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_id', ev.id);
    if ((count ?? 0) >= ev.capacity) return badRequest('As vagas deste evento acabaram.');
  }

  const { error } = await db
    .from('event_registrations')
    .insert({ event_id: ev.id, profile_id: profile.id, tenant_id: profile.tenant_id });
  if (error) return serverError('Falha ao fazer a inscrição.');
  return NextResponse.json({ success: true, registered: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;
  if (!isHr(profile.role)) return NextResponse.json({ error: 'Só RH ou admin apagam eventos.' }, { status: 403 });

  const { error } = await createAdminClient()
    .from('events')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', profile.tenant_id);
  if (error) return serverError('Falha ao apagar o evento.');
  return NextResponse.json({ success: true });
}
