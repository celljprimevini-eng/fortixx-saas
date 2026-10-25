import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, badRequest, serverError } from '@/lib/auth/session';
import { pushSubscribeSchema } from '@/lib/validation/schemas';

/**
 * Inscrição de Web Push do navegador atual.
 * POST   { endpoint, keys: { p256dh, auth } } → salva (ou passa pro usuário atual)
 * DELETE { endpoint }                          → remove
 */

export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = pushSubscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .upsert(
      {
        tenant_id: profile.tenant_id,
        profile_id: profile.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
      { onConflict: 'endpoint' },
    );
  if (error) return serverError('Falha ao ativar notificações.');
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!body || typeof body.endpoint !== 'string') return badRequest();

  await createAdminClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('profile_id', profile.id);
  return NextResponse.json({ success: true });
}
