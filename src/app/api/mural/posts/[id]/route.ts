import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, isHr, badRequest, serverError } from '@/lib/auth/session';
import { postActionSchema } from '@/lib/validation/schemas';
import { notify } from '@/lib/notify';

/**
 * Ações num post do Mural.
 * POST   { action: 'react' }               → curte / descurte (toggle)
 * POST   { action: 'comment', body }       → comenta (avisa o autor)
 * POST   { action: 'pin', pinned }         → fixa no topo (RH/admin)
 * DELETE                                    → apaga (autor ou RH/admin)
 */

async function loadPost(id: string, tenantId: string) {
  const { data } = await createAdminClient()
    .from('posts')
    .select('id, author_id, tenant_id, kind')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  return data;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const post = await loadPost(id, profile.tenant_id);
  if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });

  const parsed = postActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const input = parsed.data;
  const db = createAdminClient();

  if (input.action === 'react') {
    const { data: existing } = await db
      .from('post_reactions')
      .select('post_id')
      .eq('post_id', post.id)
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (existing) {
      await db.from('post_reactions').delete().eq('post_id', post.id).eq('profile_id', profile.id);
      return NextResponse.json({ success: true, liked: false });
    }
    const { error } = await db
      .from('post_reactions')
      .insert({ post_id: post.id, profile_id: profile.id, tenant_id: profile.tenant_id });
    if (error) return serverError();
    return NextResponse.json({ success: true, liked: true });
  }

  if (input.action === 'comment') {
    const { data, error } = await db
      .from('post_comments')
      .insert({ post_id: post.id, tenant_id: profile.tenant_id, author_id: profile.id, body: input.body })
      .select('id')
      .single();
    if (error || !data) return serverError('Falha ao comentar.');
    if (post.author_id !== profile.id) {
      await notify({
        tenantId: profile.tenant_id,
        profileIds: [post.author_id],
        category: 'sistema',
        title: `${profile.full_name.split(' ')[0]} comentou no seu post`,
        message: input.body.slice(0, 140),
        url: '/dashboard',
      });
    }
    return NextResponse.json({ success: true, id: data.id });
  }

  // pin
  if (!isHr(profile.role)) {
    return NextResponse.json({ error: 'Só RH ou admin fixam posts.' }, { status: 403 });
  }
  const { error } = await db.from('posts').update({ pinned: input.pinned }).eq('id', post.id);
  if (error) return serverError();
  return NextResponse.json({ success: true, pinned: input.pinned });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const post = await loadPost(id, profile.tenant_id);
  if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  if (post.author_id !== profile.id && !isHr(profile.role)) {
    return NextResponse.json({ error: 'Só o autor ou o RH apagam este post.' }, { status: 403 });
  }

  const { error } = await createAdminClient().from('posts').delete().eq('id', post.id);
  if (error) return serverError('Falha ao apagar.');
  return NextResponse.json({ success: true });
}
