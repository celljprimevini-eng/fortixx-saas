#!/usr/bin/env node
/**
 * UM "tick" de atividade no tenant demo (00000000-...-0001, "FAST").
 * Roda a cada ~30 min pelo GitHub Actions (.github/workflows/activity-sim.yml)
 * pra deixar o site parecendo uma empresa usando 24h: logins, candidaturas,
 * documentos, conversas com o RH, escalas, notificações ("e-mails") e, de vez
 * em quando, admissão / desligamento.
 *
 * Tudo é marcado com `[SIM]` (texto) ou `SIM:` (audit) e limpável por
 * `scripts/clean-demo-load.mjs`.
 *
 * Usa só a SERVICE_ROLE_KEY (PostgREST + Auth Admin API) — sem Access Token.
 * Local:  node scripts/activity-tick.mjs
 * CI:     lê SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY do ambiente (ver _env.mjs)
 */

import { SB_URL, H, rest, restWrite } from './_env.mjs';

const T = '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nícolas', 'Olívia', 'Paulo', 'Rafael', 'Sofia', 'Thiago', 'Yasmin', 'Beatriz', 'Caio', 'Débora', 'Enzo', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Priscila', 'Renato'];
const LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Carvalho', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Araújo', 'Ribeiro', 'Barbosa', 'Rocha', 'Dias', 'Teixeira', 'Cardoso', 'Moreira', 'Gomes'];
const genName = () => `${pick(FIRST)} ${pick(LAST)}`;
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '.');

const HR_QUESTIONS = [
  'Como solicito férias?', 'Qual o prazo pra bater o ponto?', 'Como funciona o vale-refeição?',
  'Posso trocar meu turno com um colega?', 'Quando cai o 13º salário?', 'Como acesso meu holerite?',
  'Qual o procedimento pra atestado médico?', 'Tenho direito a home office?', 'Como funciona o plano de saúde?',
  'Preciso atualizar meus dados cadastrais.',
];
const DOC_TYPES = [
  ['identidade', 'RG'], ['identidade', 'CPF'], ['identidade', 'CNH'],
  ['comprovante', 'Comprovante de residência'], ['comprovante', 'Comprovante de escolaridade'],
  ['contrato', 'Contrato assinado'], ['contrato', 'Termo de confidencialidade'],
];
const AUDIT = ['SIM:LOGIN', 'SIM:VIEW_DASHBOARD', 'SIM:VIEW_COLABORADORES', 'SIM:VIEW_ESCALAS', 'SIM:VIEW_RECRUTAMENTO', 'SIM:VIEW_DOCUMENTOS', 'SIM:EXPORT_RELATORIO', 'SIM:VIEW_ORGANOGRAMA'];
const SHIFTS = { manha: ['08:00', '16:00'], tarde: ['14:00', '22:00'], noite: ['22:00', '06:00'], folga: [null, null] };

const done = [];

async function people() {
  return rest(`profiles?select=id,full_name,status&tenant_id=eq.${T}&status=eq.active&limit=400`);
}

async function tick() {
  const pool = await people();
  if (!pool.length) { console.log('sem gente no tenant'); return; }
  const actor = pick(pool);

  // ── SEMPRE: 2-4 eventos de auditoria ────────────────────────────────────
  const audits = Array.from({ length: rint(2, 4) }, () => ({
    tenant_id: T, actor_id: pick(pool).id, action: pick(AUDIT), entity_type: 'page',
    ip_address: `187.${rint(0, 255)}.${rint(0, 255)}.${rint(0, 255)}`,
    created_at: new Date(Date.now() - rint(0, 800) * 1000).toISOString(),
  }));
  await restWrite('POST', 'audit_logs', audits);
  done.push(`${audits.length} audit`);

  // ── 40%: candidatura nova ──────────────────────────────────────────────
  if (chance(0.4)) {
    const jobs = await rest(`job_openings?select=id&tenant_id=eq.${T}&status=eq.open&limit=20`);
    if (jobs.length) {
      const nm = genName();
      await restWrite('POST', 'candidates', [{
        tenant_id: T, job_opening_id: pick(jobs).id, full_name: `[SIM] ${nm}`,
        email: `${slug(nm)}.${Math.random().toString(36).slice(2, 6)}@mail.com`,
        phone: `(11) 9${rint(1000, 9999)}-${rint(1000, 9999)}`,
        stage: pick(['recebido', 'recebido', 'triagem', 'analise']),
        source: pick(['portal_publico', 'linkedin', 'indicacao']), created_at: now(),
      }]);
      done.push('candidato');
    }
  }

  // ── 25%: documento enviado ─────────────────────────────────────────────
  if (chance(0.25)) {
    const [cat, label] = pick(DOC_TYPES);
    const p = pick(pool);
    const conf = rint(78, 99) + Math.random();
    await restWrite('POST', 'documents', [{
      tenant_id: T, profile_id: p.id, uploaded_by: p.id,
      file_name: `[SIM] ${label} - ${p.full_name}.pdf`,
      file_url: `https://storage.local/sim/${Math.random().toString(36).slice(2)}.pdf`,
      file_size_bytes: rint(120_000, 3_500_000), category: cat,
      ocr_status: chance(0.85) ? 'concluido' : 'baixa_confianca',
      ocr_confidence: Math.round(conf * 10) / 10,
      approval_status: pick(['pending', 'pending', 'approved']),
      created_at: now(),
    }]);
    done.push('documento');
  }

  // ── 25%: conversa com o RH (+ resposta) ────────────────────────────────
  if (chance(0.25)) {
    const p = pick(pool);
    const q = pick(HR_QUESTIONS);
    const conv = await restWrite('POST', 'hr_conversations', [{
      tenant_id: T, profile_id: p.id, subject: `[SIM] ${q}`,
      status: pick(['open', 'resolved', 'resolved', 'escalated']), last_message_at: now(), created_at: now(),
    }]);
    const cid = conv[0].id;
    await restWrite('POST', 'hr_messages', [
      { tenant_id: T, conversation_id: cid, role: 'user', body: q, created_at: now() },
      { tenant_id: T, conversation_id: cid, role: 'assistant', body: 'Encaminhei sua dúvida — a equipe de RH responde em breve. (resposta automática)', created_at: now() },
    ]);
    done.push('conversa RH');
  }

  // ── 20%: escala pra um dia da próxima semana ───────────────────────────
  if (chance(0.2)) {
    const p = pick(pool);
    const d = new Date(); d.setDate(d.getDate() + rint(1, 9));
    const st = pick(['manha', 'manha', 'tarde', 'tarde', 'noite', 'folga']);
    const [s, e] = SHIFTS[st];
    await fetch(`${SB_URL}/rest/v1/schedules`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([{
        tenant_id: T, profile_id: p.id, shift_date: d.toISOString().slice(0, 10),
        shift_type: st, start_time: s, end_time: e,
        status: pick(['scheduled', 'scheduled', 'confirmed']), created_by: actor.id, created_at: now(),
      }]),
    });
    done.push('escala');
  }

  // ── 15%: notificação ("e-mail") enviada ────────────────────────────────
  if (chance(0.15)) {
    const p = pick(pool);
    const kind = pick([
      ['escalas', '[SIM] Sua escala da semana foi publicada'],
      ['documentos', '[SIM] Documento aguardando sua assinatura'],
      ['onboarding', '[SIM] Nova tarefa de integração atribuída'],
      ['sistema', '[SIM] Resumo semanal do RH'],
    ]);
    await restWrite('POST', 'notifications', [{
      tenant_id: T, profile_id: p.id, category: kind[0], title: kind[1],
      message: 'Notificação enviada por e-mail e no painel.', read: chance(0.3), created_at: now(),
    }]);
    done.push('notificação/e-mail');
  }

  // ── 10%: conclui uma tarefa de onboarding em aberto ────────────────────
  if (chance(0.1)) {
    const open = await rest(`onboarding_tasks?select=id&done=eq.false&order=created_at.asc&limit=40`);
    if (open.length) {
      await restWrite('PATCH', `onboarding_tasks?id=eq.${pick(open).id}`, { done: true, done_at: now() });
      done.push('tarefa onboarding');
    }
  }

  // ── ~1 em 6 ticks: ADMISSÃO (cadastro real via Auth Admin API) ─────────
  if (chance(1 / 6)) {
    const nm = genName();
    const email = `${slug(nm)}.${Math.random().toString(36).slice(2, 5)}@sim.fortixx.local`;
    const cu = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ email, password: crypto.randomUUID(), email_confirm: true, user_metadata: { company_name: 'FAST' } }),
    });
    if (cu.ok) {
      const uid = (await cu.json()).id;
      // trigger cria tenant+profile — espera e reparenta
      let junk = null;
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pr = await rest(`profiles?id=eq.${uid}&select=tenant_id`);
        if (pr[0]) { junk = pr[0].tenant_id; break; }
      }
      if (junk) {
        const dept = pick(['d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000006']);
        await restWrite('PATCH', `profiles?id=eq.${uid}`, {
          tenant_id: T, role: 'colaborador', full_name: `[SIM] ${nm}`,
          department_id: dept, job_title: pick(['Analista Jr', 'Assistente', 'Analista Pleno', 'Estagiário']),
        });
        if (junk !== T) await fetch(`${SB_URL}/rest/v1/tenants?id=eq.${junk}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
        await restWrite('POST', 'audit_logs', [{ tenant_id: T, actor_id: actor.id, action: 'SIM:HIRE', entity_type: 'profile', entity_id: uid, created_at: now() }]);
        done.push(`ADMISSÃO ${nm}`);
      }
    }
  }

  // ── ~1 em 10 ticks: DESLIGAMENTO de um [SIM] admitido ──────────────────
  if (chance(1 / 10)) {
    const sims = await rest(`profiles?select=id,full_name&tenant_id=eq.${T}&status=eq.active&full_name=like.%5BSIM%5D%25&limit=50`);
    if (sims.length > 3) {
      const g = pick(sims);
      await restWrite('PATCH', `profiles?id=eq.${g.id}`, { status: 'inactive' });
      await restWrite('POST', 'audit_logs', [{ tenant_id: T, actor_id: actor.id, action: 'SIM:OFFBOARD', entity_type: 'profile', entity_id: g.id, created_at: now() }]);
      done.push('DESLIGAMENTO');
    }
  }

  // Mural + Autoatendimento: se a migration 0013 ainda não estiver aplicada,
  // só pula (o resto do tick segue funcionando).
  try {
    await engage(done);
  } catch (e) {
    done.push(`(mural/autoatendimento pulado: ${String(e.message).slice(0, 60)})`);
  }

  console.log(`[${now()}] tick ok →`, done.join(', '));
}

tick().catch((e) => { console.error('tick falhou:', e.message); process.exit(1); });

// ══════════════════════════════════════════════════════════════════════════
// Mural + Autoatendimento (migration 0013)
// ══════════════════════════════════════════════════════════════════════════
const POSTS = [
  'Bom dia, time! Lembrando que a reunião geral de sexta foi pra 10h.',
  'Obrigado a todo mundo que ajudou no fechamento do mês. Foi corrido, mas saiu! 👏',
  'Alguém tem indicação de curso de Excel avançado? Quero me inscrever no auxílio educação.',
  'Hoje tem bolo na copa às 15h pra comemorar a meta batida 🎂',
  'Chegou o novo lote de uniformes. Quem ainda não pegou, passa no RH.',
  'Dica de segurança: nunca compartilhe sua senha nem o código do 2FA com ninguém.',
  'Bem-vindos aos novos colegas da Operações! Contem com a gente.',
  'Lembrete: o prazo pra entregar o comprovante de residência atualizado é dia 30.',
  'Valeu pela parceria no treinamento de ontem, pessoal da Tecnologia!',
  'O estacionamento do bloco B vai estar fechado amanhã de manhã para manutenção.',
];
const COMMENTS = ['Show!', 'Valeu pelo aviso 🙌', 'Boa!', 'Obrigado!', 'Vou sim', 'Top demais', 'Anotado ✅', 'Parabéns, time!'];
const POLLS = [
  ['Qual o melhor dia para a confraternização de fim de ano?', ['Sexta à noite', 'Sábado no almoço', 'Durante o expediente']],
  ['Como você avalia a nova escala de turnos?', ['Ótima', 'Boa', 'Regular', 'Precisa mudar']],
  ['Que treinamento você quer no próximo trimestre?', ['Excel', 'Comunicação', 'Liderança', 'Segurança do trabalho']],
  ['Preferência para o cardápio de sexta?', ['Feijoada', 'Churrasco', 'Massas']],
];
const EVENTS = [
  ['Integração de novos colaboradores', 'Sala de treinamento', 'Apresentação da empresa, benefícios e tour pelas áreas.', 30],
  ['Treinamento de segurança (NR)', 'Auditório', 'Treinamento obrigatório de segurança do trabalho.', 40],
  ['Café com a diretoria', 'Copa do 2º andar', 'Bate-papo aberto sobre os resultados do trimestre.', 20],
  ['Workshop de Excel', 'Online (link no e-mail)', 'Fórmulas, tabelas dinâmicas e gráficos.', null],
];
const SR = [
  ['documento', 'Declaração de vínculo', 'Preciso de uma declaração de vínculo para abrir conta no banco.'],
  ['holerite', 'Desconto no holerite', 'Apareceu um desconto que não reconheço no último holerite.'],
  ['beneficio', 'Inclusão de dependente', 'Quero incluir meu filho no plano de saúde.'],
  ['ponto', 'Ajuste de ponto', 'Esqueci de bater o ponto na saída de ontem.'],
  ['dados_cadastrais', 'Mudança de endereço', 'Mudei de endereço, como atualizo meu cadastro?'],
];

const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const ignoreDup = { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' };

/**
 * Só perfis fictícios (loadgen / [SIM]) agem aqui. Apagar esses perfis
 * (clean-demo-load / activity-sim-clean) leva junto, em cascata, tudo que
 * eles criaram — nada fica com cara de dado real do Vini ou do cliente.
 */
async function engage(done) {
  const fake = await rest(`profiles?select=id,full_name,role,birth_date&tenant_id=eq.${T}&status=eq.active&or=(email.like.*%40loadgen.fortixx.local,email.like.*%40sim.fortixx.local)&limit=400`);
  if (fake.length < 5) return;
  const hrs = fake.filter((p) => p.role === 'rh' || p.role === 'admin');
  const leads = fake.filter((p) => ['rh', 'admin', 'gestor'].includes(p.role));
  const someone = () => pick(fake);

  // aniversário dos fictícios (preenche aos poucos, 15 por tick)
  const noBday = fake.filter((p) => !p.birth_date).slice(0, 15);
  for (const p of noBday) {
    const y = rint(1970, 2003), m = rint(1, 12), d = rint(1, 28);
    await restWrite('PATCH', `profiles?id=eq.${p.id}`, { birth_date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  if (noBday.length) done.push(`${noBday.length} aniversário(s)`);

  const recent = await rest(`posts?select=id&tenant_id=eq.${T}&order=created_at.desc&limit=15`);
  if (chance(0.18) || recent.length < 3) {
    await restWrite('POST', 'posts', [{ tenant_id: T, author_id: someone().id, body: pick(POSTS) }]);
    done.push('post no mural');
  }
  if (recent.length && chance(0.3)) {
    await fetch(`${SB_URL}/rest/v1/post_reactions`, { method: 'POST', headers: ignoreDup, body: JSON.stringify([{ post_id: pick(recent).id, profile_id: someone().id, tenant_id: T }]) });
    done.push('curtida');
  }
  if (recent.length && chance(0.15)) {
    await restWrite('POST', 'post_comments', [{ post_id: pick(recent).id, tenant_id: T, author_id: someone().id, body: pick(COMMENTS) }]);
    done.push('comentário');
  }

  const openPolls = await rest(`polls?select=id&tenant_id=eq.${T}&closed=eq.false&limit=5`);
  if (leads.length && (openPolls.length === 0 || (openPolls.length < 3 && chance(0.03)))) {
    const [q, opts] = pick(POLLS);
    const poll = await restWrite('POST', 'polls', [{ tenant_id: T, author_id: pick(leads).id, question: q, closes_at: new Date(Date.now() + 10 * 86400000).toISOString() }]);
    await restWrite('POST', 'poll_options', opts.map((label, position) => ({ poll_id: poll[0].id, tenant_id: T, label, position })));
    done.push('nova pesquisa');
  } else if (openPolls.length && chance(0.35)) {
    const poll = pick(openPolls);
    const opts = await rest(`poll_options?select=id&poll_id=eq.${poll.id}`);
    if (opts.length) {
      await fetch(`${SB_URL}/rest/v1/poll_votes`, { method: 'POST', headers: ignoreDup, body: JSON.stringify([{ poll_id: poll.id, option_id: pick(opts).id, profile_id: someone().id, tenant_id: T }]) });
      done.push('voto');
    }
  }

  if (chance(0.08)) {
    const start = rint(10, 60), len = pick([5, 10, 15, 20]);
    const who = someone();
    const clash = await rest(`leave_requests?select=id&profile_id=eq.${who.id}&status=in.(pending,approved)&limit=1`);
    if (!clash.length) {
      await restWrite('POST', 'leave_requests', [{ tenant_id: T, profile_id: who.id, kind: 'ferias', start_date: isoDay(start), end_date: isoDay(start + len - 1), days: len }]);
      done.push('pedido de férias');
    }
  }
  if (hrs.length && chance(0.06)) {
    const fakeIds = new Set(fake.map((p) => p.id));
    const pend = (await rest(`leave_requests?select=id,profile_id&tenant_id=eq.${T}&status=eq.pending&limit=20`)).filter((l) => fakeIds.has(l.profile_id));
    if (pend.length) {
      await restWrite('PATCH', `leave_requests?id=eq.${pick(pend).id}`, { status: chance(0.85) ? 'approved' : 'rejected', decided_by: pick(hrs).id, decided_at: now() });
      done.push('férias decididas');
    }
  }

  if (chance(0.07)) {
    const [category, subject, body] = pick(SR);
    await restWrite('POST', 'service_requests', [{ tenant_id: T, profile_id: someone().id, category, subject, body }]);
    done.push('solicitação ao RH');
  }
  if (hrs.length && chance(0.05)) {
    const fakeIds = new Set(fake.map((p) => p.id));
    const open = (await rest(`service_requests?select=id,profile_id&tenant_id=eq.${T}&status=in.(open,in_progress)&limit=20`)).filter((r) => fakeIds.has(r.profile_id));
    if (open.length) {
      await restWrite('PATCH', `service_requests?id=eq.${pick(open).id}`, { status: 'done', response: 'Resolvido! Qualquer dúvida, é só chamar.', handled_by: pick(hrs).id, updated_at: now() });
      done.push('solicitação atendida');
    }
  }

  const upcoming = await rest(`events?select=id&tenant_id=eq.${T}&starts_at=gte.${new Date().toISOString()}&limit=10`);
  if (hrs.length && (upcoming.length === 0 || (upcoming.length < 4 && chance(0.03)))) {
    const [title, location, description, capacity] = pick(EVENTS);
    const start = new Date(Date.now() + rint(3, 25) * 86400000);
    start.setUTCHours(rint(12, 19), 0, 0, 0);
    await restWrite('POST', 'events', [{ tenant_id: T, title, location, description, capacity, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), created_by: pick(hrs).id }]);
    done.push('novo evento');
  } else if (upcoming.length && chance(0.12)) {
    await fetch(`${SB_URL}/rest/v1/event_registrations`, { method: 'POST', headers: ignoreDup, body: JSON.stringify([{ event_id: pick(upcoming).id, profile_id: someone().id, tenant_id: T }]) });
    done.push('inscrição em evento');
  }
}
