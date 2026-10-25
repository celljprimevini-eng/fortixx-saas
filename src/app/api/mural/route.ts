import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, isHr, badRequest, serverError } from '@/lib/auth/session';
import { muralCreateSchema } from '@/lib/validation/schemas';
import { notify, tenantProfileIds } from '@/lib/notify';

/**
 * Mural da empresa (dashboard › Mural).
 *
 * GET  → tudo que a tela precisa numa ida só: posts (com autor, curtidas e
 *        comentários), enquetes (com contagem por opção e o voto do usuário)
 *        e aniversariantes do mês.
 * POST → { type: 'post' | 'poll' | 'parabens', ... } (ver muralCreateSchema).
 *        Comunicado oficial e enquete: só RH/admin (enquete também gestor).
 *
 * Leitura e escrita pela service_role, sempre filtrando pelo tenant do
 * usuário logado (requireProfile). As tabelas só têm RLS de SELECT.
 */

const POST_LIMIT = 40;
const COMMENTS_PER_POST = 20;
const POLL_LIMIT = 10;

/** 'AAAA-MM-DD' no fuso de São Paulo (aniversário e "hoje" são datas locais). */
const spDate = (d: Date | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(d));

export async function GET() {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;
  const db = createAdminClient();
  const t = profile.tenant_id;

  const [{ data: posts }, { data: polls }, { data: people }] = await Promise.all([
    db
      .from('posts')
      .select('id, author_id, kind, body, subject_profile_id, pinned, created_at')
      .eq('tenant_id', t)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(POST_LIMIT),
    db
      .from('polls')
      .select('id, author_id, question, anonymous, closes_at, closed, created_at')
      .eq('tenant_id', t)
      .order('created_at', { ascending: false })
      .limit(POLL_LIMIT),
    db
      .from('profiles')
      .select('id, full_name, job_title, role, birth_date, status')
      .eq('tenant_id', t),
  ]);

  const postIds = (posts ?? []).map((p) => p.id);
  const pollIds = (polls ?? []).map((p) => p.id);

  const [{ data: reactions }, { data: comments }, { data: options }, { data: votes }] = await Promise.all([
    postIds.length
      ? db.from('post_reactions').select('post_id, profile_id').in('post_id', postIds)
      : Promise.resolve({ data: [] as { post_id: string; profile_id: string }[] }),
    postIds.length
      ? db
          .from('post_comments')
          .select('id, post_id, author_id, body, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; post_id: string; author_id: string; body: string; created_at: string }[] }),
    pollIds.length
      ? db.from('poll_options').select('id, poll_id, label, position').in('poll_id', pollIds).order('position')
      : Promise.resolve({ data: [] as { id: string; poll_id: string; label: string; position: number }[] }),
    pollIds.length
      ? db.from('poll_votes').select('poll_id, option_id, profile_id').in('poll_id', pollIds)
      : Promise.resolve({ data: [] as { poll_id: string; option_id: string; profile_id: string }[] }),
  ]);

  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const person = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    return p ? { id: p.id, name: p.full_name, job_title: p.job_title } : { id, name: 'Ex-colaborador', job_title: null };
  };

  const feed = (posts ?? []).map((p) => {
    const rs = (reactions ?? []).filter((r) => r.post_id === p.id);
    const cs = (comments ?? []).filter((c) => c.post_id === p.id);
    return {
      id: p.id,
      kind: p.kind,
      body: p.body,
      pinned: p.pinned,
      created_at: p.created_at,
      author: person(p.author_id),
      subject: p.subject_profile_id ? person(p.subject_profile_id) : null,
      likes: rs.length,
      liked: rs.some((r) => r.profile_id === profile.id),
      can_delete: p.author_id === profile.id || isHr(profile.role),
      comments_count: cs.length,
      comments: cs.slice(-COMMENTS_PER_POST).map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        author: person(c.author_id),
      })),
    };
  });

  const now = Date.now();
  const pollList = (polls ?? []).map((p) => {
    const opts = (options ?? []).filter((o) => o.poll_id === p.id);
    const vs = (votes ?? []).filter((v) => v.poll_id === p.id);
    const closed = p.closed || (p.closes_at ? new Date(p.closes_at).getTime() < now : false);
    return {
      id: p.id,
      question: p.question,
      anonymous: p.anonymous,
      closes_at: p.closes_at,
      closed,
      created_at: p.created_at,
      author: person(p.author_id),
      total: vs.length,
      my_vote: vs.find((v) => v.profile_id === profile.id)?.option_id ?? null,
      can_close: isHr(profile.role) || p.author_id === profile.id,
      options: opts.map((o) => ({ id: o.id, label: o.label, votes: vs.filter((v) => v.option_id === o.id).length })),
    };
  });

  // Aniversariantes do mês corrente (fuso de São Paulo).
  const todayKey = spDate(new Date());
  const month = Number(todayKey.slice(5, 7));
  const day = Number(todayKey.slice(8, 10));
  const birthdays = (people ?? [])
    .filter((p) => p.status !== 'inactive' && p.birth_date && Number(p.birth_date.slice(5, 7)) === month)
    .map((p) => {
      const d = Number(p.birth_date!.slice(8, 10));
      return { id: p.id, name: p.full_name, job_title: p.job_title, day: d, today: d === day };
    })
    .sort((a, b) => a.day - b.day);

  const congratulatedToday = feed
    .filter((p) => p.kind === 'aniversario' && p.author.id === profile.id && spDate(p.created_at) === todayKey)
    .map((p) => p.subject?.id);

  return NextResponse.json({
    me: {
      id: profile.id,
      role: profile.role,
      name: profile.full_name,
      can_post_official: isHr(profile.role),
      can_create_poll: ['admin', 'rh', 'gestor'].includes(profile.role),
      birth_date: byId.get(profile.id)?.birth_date ?? null,
    },
    posts: feed,
    polls: pollList,
    birthdays: birthdays.map((b) => ({ ...b, congratulated: congratulatedToday.includes(b.id) })),
    push_public_key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = muralCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const input = parsed.data;
  const db = createAdminClient();
  const t = profile.tenant_id;

  if (input.type === 'post') {
    if (input.comunicado && !isHr(profile.role)) {
      return NextResponse.json({ error: 'Só RH ou admin publicam comunicado oficial.' }, { status: 403 });
    }
    const { data, error } = await db
      .from('posts')
      .insert({
        tenant_id: t,
        author_id: profile.id,
        kind: input.comunicado ? 'comunicado' : 'post',
        body: input.body,
        pinned: input.comunicado,
      })
      .select('id')
      .single();
    if (error || !data) return serverError('Falha ao publicar.');

    if (input.comunicado) {
      const ids = (await tenantProfileIds(t)).filter((id) => id !== profile.id);
      await notify({
        tenantId: t,
        profileIds: ids,
        category: 'sistema',
        title: 'Novo comunicado',
        message: input.body.slice(0, 140),
        url: '/dashboard',
      });
    }
    return NextResponse.json({ success: true, id: data.id });
  }

  if (input.type === 'poll') {
    if (!['admin', 'rh', 'gestor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Só RH, admin ou gestor criam enquetes.' }, { status: 403 });
    }
    const { data: poll, error } = await db
      .from('polls')
      .insert({
        tenant_id: t,
        author_id: profile.id,
        question: input.question,
        anonymous: input.anonymous,
        closes_at: input.closes_at ?? null,
      })
      .select('id')
      .single();
    if (error || !poll) return serverError('Falha ao criar a enquete.');

    const { error: optErr } = await db
      .from('poll_options')
      .insert(input.options.map((label, position) => ({ poll_id: poll.id, tenant_id: t, label, position })));
    if (optErr) {
      await db.from('polls').delete().eq('id', poll.id);
      return serverError('Falha ao criar as opções da enquete.');
    }

    const ids = (await tenantProfileIds(t)).filter((id) => id !== profile.id);
    await notify({
      tenantId: t,
      profileIds: ids,
      category: 'sistema',
      title: 'Nova pesquisa no Mural',
      message: input.question.slice(0, 140),
      url: '/dashboard',
    });
    return NextResponse.json({ success: true, id: poll.id });
  }

  // parabéns de aniversário
  const { data: subject } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('id', input.subject_profile_id)
    .eq('tenant_id', t)
    .single();
  if (!subject) return badRequest('Colaborador não encontrado.');
  if (subject.id === profile.id) return badRequest('Não dá pra dar parabéns pra si mesmo.');

  const { data: recent } = await db
    .from('posts')
    .select('created_at')
    .eq('tenant_id', t)
    .eq('kind', 'aniversario')
    .eq('author_id', profile.id)
    .eq('subject_profile_id', subject.id)
    .gte('created_at', new Date(Date.now() - 36 * 3600 * 1000).toISOString());
  if ((recent ?? []).some((p) => spDate(p.created_at) === spDate(new Date()))) {
    return badRequest('Você já deu parabéns hoje.');
  }

  const { data, error } = await db
    .from('posts')
    .insert({
      tenant_id: t,
      author_id: profile.id,
      kind: 'aniversario',
      body: input.body,
      subject_profile_id: subject.id,
    })
    .select('id')
    .single();
  if (error || !data) return serverError('Falha ao publicar os parabéns.');

  await notify({
    tenantId: t,
    profileIds: [subject.id],
    category: 'sistema',
    title: `${profile.full_name.split(' ')[0]} te deu parabéns 🎉`,
    message: input.body.slice(0, 140),
    url: '/dashboard',
  });
  return NextResponse.json({ success: true, id: data.id });
}
