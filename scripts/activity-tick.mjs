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

  console.log(`[${now()}] tick ok →`, done.join(', '));
}

tick().catch((e) => { console.error('tick falhou:', e.message); process.exit(1); });
