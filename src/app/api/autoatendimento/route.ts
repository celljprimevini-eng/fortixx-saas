import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, isHr, badRequest, serverError } from '@/lib/auth/session';
import { autoatendimentoCreateSchema } from '@/lib/validation/schemas';
import { notify, hrProfileIds, tenantProfileIds } from '@/lib/notify';
import { inclusiveDays, todaySp, signatureHash } from '@/lib/autoatendimento';

/**
 * Autoatendimento do colaborador (dashboard › Autoatendimento).
 *
 * GET  → pedidos de férias/folga, solicitações ao RH, eventos e assinaturas.
 *        Colaborador vê os próprios; gestor vê os próprios + da equipe direta
 *        (profiles.manager_id); RH/admin veem tudo do tenant.
 * POST → { type: 'ferias' | 'solicitacao' | 'evento' | 'assinatura', ... }
 *        Evento e pedido de assinatura: só RH/admin.
 */

export async function GET() {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;
  const db = createAdminClient();
  const t = profile.tenant_id;
  const hr = isHr(profile.role);

  const { data: people } = await db
    .from('profiles')
    .select('id, full_name, job_title, manager_id, status')
    .eq('tenant_id', t);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const name = (id: string | null) => (id ? byId.get(id)?.full_name ?? 'Ex-colaborador' : null);

  // Quem eu posso ver: eu, minha equipe direta (gestor) ou todo mundo (RH).
  const team = (people ?? []).filter((p) => p.manager_id === profile.id).map((p) => p.id);
  const visible = hr ? null : [profile.id, ...(profile.role === 'gestor' ? team : [])];

  let leaveQ = db
    .from('leave_requests')
    .select('id, profile_id, kind, start_date, end_date, days, note, status, decided_by, decided_at, decision_note, created_at')
    .eq('tenant_id', t)
    .order('created_at', { ascending: false })
    .limit(200);
  if (visible) leaveQ = leaveQ.in('profile_id', visible);

  let reqQ = db
    .from('service_requests')
    .select('id, profile_id, category, subject, body, status, response, handled_by, created_at, updated_at')
    .eq('tenant_id', t)
    .order('created_at', { ascending: false })
    .limit(200);
  if (!hr) reqQ = reqQ.eq('profile_id', profile.id);

  let sigQ = db
    .from('signature_requests')
    .select('id, profile_id, title, content, content_hash, status, requested_by, signed_name, signed_at, signer_ip, created_at')
    .eq('tenant_id', t)
    .order('created_at', { ascending: false })
    .limit(300);
  if (!hr) sigQ = sigQ.eq('profile_id', profile.id);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: leaves }, { data: requests }, { data: sigs }, { data: events }] = await Promise.all([
    leaveQ,
    reqQ,
    sigQ,
    db
      .from('events')
      .select('id, title, description, location, starts_at, ends_at, capacity, created_by')
      .eq('tenant_id', t)
      .gte('starts_at', since)
      .order('starts_at', { ascending: true })
      .limit(60),
  ]);

  const eventIds = (events ?? []).map((e) => e.id);
  const { data: regs } = eventIds.length
    ? await db.from('event_registrations').select('event_id, profile_id').in('event_id', eventIds)
    : { data: [] as { event_id: string; profile_id: string }[] };

  const year = todaySp().slice(0, 4);
  const myLeaves = (leaves ?? []).filter((l) => l.profile_id === profile.id);

  return NextResponse.json({
    me: { id: profile.id, role: profile.role, name: profile.full_name, is_hr: hr, team_size: team.length },
    ferias_resumo: {
      aprovados_no_ano: myLeaves
        .filter((l) => l.kind === 'ferias' && l.status === 'approved' && l.start_date.startsWith(year))
        .reduce((s, l) => s + l.days, 0),
      pendentes: myLeaves.filter((l) => l.status === 'pending').length,
    },
    ferias: (leaves ?? []).map((l) => ({
      ...l,
      person: name(l.profile_id),
      decided_by_name: name(l.decided_by),
      mine: l.profile_id === profile.id,
      can_decide:
        l.status === 'pending' &&
        l.profile_id !== profile.id &&
        (hr || (profile.role === 'gestor' && team.includes(l.profile_id))),
    })),
    solicitacoes: (requests ?? []).map((r) => ({
      ...r,
      person: name(r.profile_id),
      handled_by_name: name(r.handled_by),
      mine: r.profile_id === profile.id,
    })),
    eventos: (events ?? []).map((e) => {
      const rs = (regs ?? []).filter((r) => r.event_id === e.id);
      return {
        ...e,
        registered: rs.length,
        me_registered: rs.some((r) => r.profile_id === profile.id),
        full: e.capacity != null && rs.length >= e.capacity,
        past: new Date(e.ends_at ?? e.starts_at).getTime() < Date.now(),
        attendees: hr ? rs.map((r) => name(r.profile_id)) : undefined,
      };
    }),
    assinaturas: (sigs ?? []).map((s) => ({
      ...s,
      person: name(s.profile_id),
      requested_by_name: name(s.requested_by),
      mine: s.profile_id === profile.id,
      // IP do signatário só aparece pro próprio e pro RH (já filtrado acima).
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = autoatendimentoCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const input = parsed.data;
  const db = createAdminClient();
  const t = profile.tenant_id;

  if (input.type === 'ferias') {
    if (input.end_date < input.start_date) return badRequest('A data final é antes da inicial.');
    if (input.start_date < todaySp()) return badRequest('Não dá pra pedir período que já começou.');
    const days = inclusiveDays(input.start_date, input.end_date);
    // CLT art. 134 §1º: férias podem ser fracionadas em até 3 períodos, um com
    // no mínimo 14 dias e os demais com no mínimo 5 dias corridos.
    if (input.kind === 'ferias' && days < 5) return badRequest('Período de férias precisa ter no mínimo 5 dias (CLT).');
    if (days > 60) return badRequest('Período longo demais para um pedido só.');

    const { data: overlap } = await db
      .from('leave_requests')
      .select('id')
      .eq('profile_id', profile.id)
      .in('status', ['pending', 'approved'])
      .lte('start_date', input.end_date)
      .gte('end_date', input.start_date)
      .limit(1);
    if ((overlap ?? []).length > 0) return badRequest('Você já tem um pedido nesse período.');

    const { data, error } = await db
      .from('leave_requests')
      .insert({
        tenant_id: t,
        profile_id: profile.id,
        kind: input.kind,
        start_date: input.start_date,
        end_date: input.end_date,
        days,
        note: input.note || null,
      })
      .select('id')
      .single();
    if (error || !data) return serverError('Falha ao registrar o pedido.');

    const { data: me } = await db.from('profiles').select('manager_id').eq('id', profile.id).single();
    const label = input.kind === 'ferias' ? 'férias' : input.kind === 'folga' ? 'folga' : 'licença';
    await notify({
      tenantId: t,
      profileIds: [...(await hrProfileIds(t)), ...(me?.manager_id ? [me.manager_id] : [])].filter((id) => id !== profile.id),
      category: 'escalas',
      title: `Pedido de ${label}: ${profile.full_name}`,
      message: `${days} dia(s), de ${input.start_date.split('-').reverse().join('/')} a ${input.end_date.split('-').reverse().join('/')}.`,
      url: '/dashboard',
    });
    return NextResponse.json({ success: true, id: data.id, days });
  }

  if (input.type === 'solicitacao') {
    const { data, error } = await db
      .from('service_requests')
      .insert({ tenant_id: t, profile_id: profile.id, category: input.category, subject: input.subject, body: input.body })
      .select('id')
      .single();
    if (error || !data) return serverError('Falha ao abrir a solicitação.');
    await notify({
      tenantId: t,
      profileIds: (await hrProfileIds(t)).filter((id) => id !== profile.id),
      category: 'documentos',
      title: `Nova solicitação: ${input.subject}`,
      message: `${profile.full_name} — ${input.body.slice(0, 120)}`,
      url: '/dashboard',
    });
    return NextResponse.json({ success: true, id: data.id });
  }

  // evento e assinatura: só RH/admin
  if (!isHr(profile.role)) {
    return NextResponse.json({ error: 'Só RH ou admin podem criar isso.' }, { status: 403 });
  }

  if (input.type === 'evento') {
    if (input.ends_at && input.ends_at < input.starts_at) return badRequest('O fim é antes do início.');
    const { data, error } = await db
      .from('events')
      .insert({
        tenant_id: t,
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at ?? null,
        capacity: input.capacity ?? null,
        created_by: profile.id,
      })
      .select('id')
      .single();
    if (error || !data) return serverError('Falha ao criar o evento.');
    await notify({
      tenantId: t,
      profileIds: (await tenantProfileIds(t)).filter((id) => id !== profile.id),
      category: 'sistema',
      title: `Novo evento: ${input.title}`,
      message: new Date(input.starts_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }),
      url: '/dashboard',
    });
    return NextResponse.json({ success: true, id: data.id });
  }

  // assinatura: uma linha por signatário, com o hash do conteúdo exato
  let signers = input.profile_ids?.length ? input.profile_ids : await tenantProfileIds(t);
  const { data: valid } = await db.from('profiles').select('id').eq('tenant_id', t).in('id', signers);
  signers = (valid ?? []).map((p) => p.id);
  if (signers.length === 0) return badRequest('Nenhum colaborador válido para assinar.');

  const hash = signatureHash(input.title, input.content);
  const { error } = await db.from('signature_requests').insert(
    signers.map((profile_id) => ({
      tenant_id: t,
      profile_id,
      title: input.title,
      content: input.content,
      content_hash: hash,
      requested_by: profile.id,
    })),
  );
  if (error) return serverError('Falha ao enviar para assinatura.');
  await notify({
    tenantId: t,
    profileIds: signers,
    category: 'documentos',
    title: 'Documento para você assinar',
    message: input.title,
    url: '/dashboard',
  });
  return NextResponse.json({ success: true, count: signers.length, content_hash: hash });
}
