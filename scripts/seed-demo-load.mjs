#!/usr/bin/env node
/**
 * Popula o tenant DEMO (00000000-...-0001, "Fortixx Demo LTDA") com dados
 * realistas na escala de uma empresa de ~100 pessoas usando o sistema
 * diariamente — pra testar/apresentar o dashboard com volume de verdade.
 *
 * Idempotente: apaga a carga anterior (chaves com marcador) e recria. Só
 * mexe no tenant demo, nunca em outro. Roda o trigger on_auth_user_created
 * desligado durante o insert de auth.users e liga de novo no fim (na mesma
 * transação, então se falhar, volta ligado sozinho).
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/seed-demo-load.mjs
 */

import { randomUUID } from 'node:crypto';
import { sql, q, TENANT, rng, pick, rint, daysAgo, NOMES, SOBRENOMES } from './_lib.mjs';

const r = rng(20260901);
const LG = '[LG]'; // marcador pra limpeza idempotente
const EMAIL_DOMAIN = 'loadgen.fortixx.local';

const N_PROFILES = 100;
const N_JOBS = 10;
const N_CANDIDATES = 220;
const N_INTERVIEWS = 35;
const N_ONBOARDINGS = 25;
const N_SCHEDULES = 140;
const N_DOCUMENTS = 55;
const N_TRAININGS = 6;
const N_AUDIT = 500;
const N_NOTIF = 45;
const N_CONVERSATIONS = 40;

// ── Departamentos (fixos, scoped ao tenant demo) ────────────────────────────
const DEPTS = [
  ['d0000000-0000-0000-0000-000000000001', 'Diretoria'],
  ['d0000000-0000-0000-0000-000000000002', 'Recursos Humanos'],
  ['d0000000-0000-0000-0000-000000000003', 'Comercial'],
  ['d0000000-0000-0000-0000-000000000004', 'Tecnologia'],
  ['d0000000-0000-0000-0000-000000000005', 'Operações'],
  ['d0000000-0000-0000-0000-000000000006', 'Financeiro'],
];

const CARGOS = {
  'Diretoria': ['CEO', 'Diretor de Operações', 'Diretora Financeira'],
  'Recursos Humanos': ['Gerente de RH', 'Analista de RH', 'Analista de DP', 'Recrutadora', 'Estagiário de RH'],
  'Comercial': ['Gerente Comercial', 'Executivo de Vendas', 'SDR', 'Analista de CRM', 'Coordenador de Vendas'],
  'Tecnologia': ['Tech Lead', 'Dev Backend', 'Dev Frontend', 'Dev Pleno', 'QA', 'Product Manager', 'Designer'],
  'Operações': ['Gerente de Operações', 'Analista de Operações', 'Assistente Operacional', 'Coordenador de Logística'],
  'Financeiro': ['Gerente Financeiro', 'Analista Financeiro', 'Assistente Financeiro', 'Contador'],
};

// ── Gera profiles ──────────────────────────────────────────────────────────
const used = new Set();
function nome() {
  for (;;) {
    const n = `${pick(r, NOMES)} ${pick(r, SOBRENOMES)}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
}

const profiles = [];
for (let i = 0; i < N_PROFILES; i++) {
  const dept = i === 0 ? DEPTS[0] : pick(r, DEPTS);
  const full = nome();
  const roleWeighted = i === 0 ? 'admin'
    : dept[1] === 'Recursos Humanos' && r() < 0.5 ? 'rh'
    : r() < 0.12 ? 'gestor'
    : 'colaborador';
  profiles.push({
    id: randomUUID(),
    full,
    email: `p${String(i).padStart(3, '0')}@${EMAIL_DOMAIN}`,
    role: roleWeighted,
    dept,
    job_title: pick(r, CARGOS[dept[1]]),
    status: r() < 0.88 ? 'active' : r() < 0.7 ? 'on_leave' : 'inactive',
    phone: `+55 11 9${rint(r, 1000, 9999)}-${rint(r, 1000, 9999)}`,
    created_at: daysAgo(r, rint(r, 5, 560)),
    idx: i,
  });
}
// hierarquia: 0 = topo; heads = quem tem "Gerente"/"Lead"/"Diretor" no cargo, reportam ao 0;
// resto reporta a um head do mesmo depto (ou ao 0).
const heads = profiles.filter((p) => p.idx !== 0 && /Gerente|Lead|Diretor|Coordenador/.test(p.job_title));
for (const p of profiles) {
  if (p.idx === 0) { p.manager = null; continue; }
  if (heads.includes(p)) { p.manager = profiles[0].id; continue; }
  const sameDept = heads.filter((h) => h.dept[0] === p.dept[0]);
  p.manager = (sameDept.length ? pick(r, sameDept) : profiles[0]).id;
}

const authValues = profiles.map((p) =>
  `('00000000-0000-0000-0000-000000000000', ${q(p.id)}, 'authenticated', 'authenticated', ${q(p.email)}, '$2a$10$loadgenloadgenloadgenloadgenloadgenloadgenlo', now(), ${q(p.created_at)}, ${q(p.created_at)}, '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ full_name: p.full }))}, false, '', '', '', '')`
).join(',\n');

const profValues = profiles.map((p) =>
  `(${q(p.id)}, ${q(TENANT)}, ${q(p.full)}, ${q(p.email)}, ${q(p.role)}, ${q(p.dept[0])}, ${q(p.job_title)}, ${q(p.status)}, ${q(p.phone)}, ${q(p.created_at)}, ${q(p.created_at)})`
).join(',\n');

const mgrUpdates = profiles.filter((p) => p.manager)
  .map((p) => `update profiles set manager_id=${q(p.manager)} where id=${q(p.id)};`).join('\n');

// ── CHUNK 1: limpeza + departamentos + auth.users + profiles (transacional) ──
const chunk1 = `
alter table auth.users disable trigger on_auth_user_created;

-- limpeza da carga anterior (email marker -> cascade apaga profiles e o que depende deles)
delete from auth.users where email like '%@${EMAIL_DOMAIN}';
delete from hr_messages where tenant_id=${q(TENANT)} and conversation_id in (select id from hr_conversations where subject like ${q(LG + '%')});
delete from hr_conversations where tenant_id=${q(TENANT)} and subject like ${q(LG + '%')};
delete from audit_logs where tenant_id=${q(TENANT)} and action like 'LG:%';
delete from notifications where tenant_id=${q(TENANT)} and title like ${q(LG + '%')};
delete from interviews where tenant_id=${q(TENANT)};
delete from candidates where tenant_id=${q(TENANT)} and full_name like ${q(LG + '%')};
delete from job_openings where tenant_id=${q(TENANT)} and title like ${q(LG + '%')};
delete from training_progress where tenant_id=${q(TENANT)};
delete from trainings where tenant_id=${q(TENANT)} and title like ${q(LG + '%')};
delete from onboarding_tasks where onboarding_id in (select id from onboardings where tenant_id=${q(TENANT)});
delete from onboardings where tenant_id=${q(TENANT)};
delete from schedules where tenant_id=${q(TENANT)};
delete from documents where tenant_id=${q(TENANT)} and file_name like ${q(LG + '%')};

insert into departments (id, tenant_id, name) values
${DEPTS.map((d) => `(${q(d[0])}, ${q(TENANT)}, ${q(d[1])})`).join(',\n')}
on conflict (id) do nothing;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change)
values
${authValues};

insert into profiles (id, tenant_id, full_name, email, role, department_id, job_title, status, phone, created_at, updated_at)
values
${profValues};

${mgrUpdates}

alter table auth.users enable trigger on_auth_user_created;
`;

// ── CHUNK 2: job_openings + candidates + interviews ─────────────────────────
const jobs = [];
for (let i = 0; i < N_JOBS; i++) {
  const dept = pick(r, DEPTS.slice(1));
  jobs.push({
    id: randomUUID(),
    title: `${LG} ${pick(r, CARGOS[dept[1]])}`,
    dept: dept[0],
    location: pick(r, ['Remoto', 'São Paulo, SP', 'Curitiba, PR', 'Híbrido - SP', 'Recife, PE']),
    employment_type: pick(r, ['clt', 'pj', 'estagio']),
    status: i < 6 ? 'open' : i < 8 ? 'paused' : 'closed',
    created_at: daysAgo(r, rint(r, 3, 100)),
  });
}
const STAGES = ['recebido', 'recebido', 'triagem', 'triagem', 'analise', 'entrevista', 'entrevista', 'aprovado', 'reprovado'];
const candidates = [];
for (let i = 0; i < N_CANDIDATES; i++) {
  const created = rint(r, 1, 120);
  const stage = pick(r, STAGES);
  const advanced = stage === 'aprovado' ? rint(r, 3, 25) : 0;
  candidates.push({
    id: randomUUID(),
    full_name: `${LG} ${nome()}`,
    email: `c${String(i).padStart(3, '0')}@${EMAIL_DOMAIN}`,
    job: pick(r, jobs).id,
    stage,
    created_at: daysAgo(r, created),
    updated_at: daysAgo(r, Math.max(0, created - advanced)),
  });
}
const interviews = [];
const entrevistaCands = candidates.filter((c) => ['entrevista', 'aprovado'].includes(c.stage));
for (let i = 0; i < Math.min(N_INTERVIEWS, entrevistaCands.length); i++) {
  const c = entrevistaCands[i];
  interviews.push({
    id: randomUUID(),
    candidate: c.id,
    job: c.job,
    interviewer: pick(r, profiles.filter((p) => p.role !== 'colaborador')).id,
    scheduled_at: daysAgo(r, rint(r, -10, 20)),
    status: pick(r, ['agendada', 'agendada', 'realizada', 'realizada', 'cancelada', 'reagendada']),
  });
}

const chunk2 = `
insert into job_openings (id, tenant_id, title, department_id, location, employment_type, status, created_at) values
${jobs.map((j) => `(${q(j.id)}, ${q(TENANT)}, ${q(j.title)}, ${q(j.dept)}, ${q(j.location)}, ${q(j.employment_type)}, ${q(j.status)}, ${q(j.created_at)})`).join(',\n')};

insert into candidates (id, tenant_id, full_name, email, job_opening_id, stage, created_at, updated_at) values
${candidates.map((c) => `(${q(c.id)}, ${q(TENANT)}, ${q(c.full_name)}, ${q(c.email)}, ${q(c.job)}, ${q(c.stage)}, ${q(c.created_at)}, ${q(c.updated_at)})`).join(',\n')};

insert into interviews (id, tenant_id, candidate_id, job_opening_id, interviewer_id, scheduled_at, status) values
${interviews.map((iv) => `(${q(iv.id)}, ${q(TENANT)}, ${q(iv.candidate)}, ${q(iv.job)}, ${q(iv.interviewer)}, ${q(iv.scheduled_at)}, ${q(iv.status)})`).join(',\n')};
`;

// ── CHUNK 3: onboardings + tasks + schedules + documents + trainings ────────
const ONB_TASKS = ['Assinar contrato', 'Enviar documentos', 'Configurar acesso aos sistemas', 'Reunião com o gestor', 'Treinamento de segurança', 'Conhecer o time', 'Definir metas do 1º mês'];
const newHires = profiles.filter((p) => p.status === 'active').slice(0, N_ONBOARDINGS);
const onboardings = newHires.map((p) => ({
  id: randomUUID(), profile: p.id,
  status: 'em_andamento',
  start_date: daysAgo(r, rint(r, 1, 28)).slice(0, 10),
}));
const onbTaskRows = [];
for (const o of onboardings) {
  const n = rint(r, 4, 7);
  for (let k = 0; k < n; k++) {
    onbTaskRows.push(`(${q(randomUUID())}, ${q(o.id)}, ${q(ONB_TASKS[k])}, ${r() < 0.45}, ${k})`);
  }
}
const SHIFTS = ['manha', 'tarde', 'noite', 'folga'];
const SCH_STATUS = ['scheduled', 'confirmed', 'confirmed', 'completed', 'absent'];
const now = new Date();
const schedRows = [];
const schedProfiles = profiles.filter((p) => p.status === 'active');
for (let i = 0; i < N_SCHEDULES; i++) {
  const p = pick(r, schedProfiles);
  const day = rint(r, 1, 28);
  const date = new Date(now.getFullYear(), now.getMonth(), day).toISOString().slice(0, 10);
  const shift = pick(r, SHIFTS);
  const times = shift === 'folga' ? ['null', 'null']
    : shift === 'manha' ? [`'06:00'`, `'14:00'`]
    : shift === 'tarde' ? [`'14:00'`, `'22:00'`]
    : [`'22:00'`, `'06:00'`];
  schedRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(p.id)}, ${q(date)}, ${q(shift)}, ${times[0]}, ${times[1]}, ${q(pick(r, SCH_STATUS))})`);
}
const DOC_CAT = ['identidade', 'comprovante', 'contrato', 'curriculo', 'outro'];
const OCR = ['pendente', 'processando', 'concluido', 'concluido', 'falhou', 'baixa_confianca'];
const APPROVAL = ['pending', 'approved', 'approved', 'rejected'];
const docRows = [];
for (let i = 0; i < N_DOCUMENTS; i++) {
  const p = pick(r, profiles);
  const cat = pick(r, DOC_CAT);
  docRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(p.id)}, ${q(LG + ' ' + cat + '_' + i + '.pdf')}, ${q(cat)}, ${q(pick(r, OCR))}, ${rint(r, 55, 99)}, ${q(pick(r, APPROVAL))}, ${q(daysAgo(r, rint(r, 1, 60)))})`);
}
const TRAININGS = ['Segurança da Informação', 'Código de Conduta', 'LGPD na Prática', 'Onboarding Cultural', 'Prevenção ao Assédio', 'Ferramentas Internas'];
const trainings = TRAININGS.slice(0, N_TRAININGS).map((t) => ({ id: randomUUID(), title: `${LG} ${t}` }));
const progRows = [];
for (const t of trainings) {
  for (const p of profiles.filter(() => r() < 0.7)) {
    const pct = r() < 0.5 ? 100 : rint(r, 0, 95);
    progRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(t.id)}, ${q(p.id)}, ${pct}, ${pct >= 100 ? q(daysAgo(r, rint(r, 1, 40))) : 'null'})`);
  }
}

const chunk3 = `
insert into onboardings (id, tenant_id, profile_id, status, start_date) values
${onboardings.map((o) => `(${q(o.id)}, ${q(TENANT)}, ${q(o.profile)}, ${q(o.status)}, ${q(o.start_date)})`).join(',\n')};

insert into onboarding_tasks (id, onboarding_id, title, done, order_index) values
${onbTaskRows.join(',\n')};

insert into schedules (id, tenant_id, profile_id, shift_date, shift_type, start_time, end_time, status) values
${schedRows.join(',\n')};

insert into documents (id, tenant_id, profile_id, file_name, category, ocr_status, ocr_confidence, approval_status, created_at) values
${docRows.join(',\n')};

insert into trainings (id, tenant_id, title) values
${trainings.map((t) => `(${q(t.id)}, ${q(TENANT)}, ${q(t.title)})`).join(',\n')};

insert into training_progress (id, tenant_id, training_id, profile_id, progress_pct, completed_at) values
${progRows.join(',\n')};
`;

// ── CHUNK 4: audit_logs + notifications + hr_conversations + hr_messages ─────
const ACTIONS = ['LG: login', 'LG: aprovou candidato', 'LG: editou colaborador', 'LG: marcou tarefa de onboarding', 'LG: criou vaga', 'LG: enviou documento', 'LG: atualizou escala', 'LG: convidou usuário'];
const auditRows = [];
for (let i = 0; i < N_AUDIT; i++) {
  const p = pick(r, profiles);
  auditRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(p.id)}, ${q(pick(r, ACTIONS))}, 'profiles', ${q(`10.0.${rint(r, 0, 255)}.${rint(r, 1, 254)}`)}, ${q(daysAgo(r, rint(r, 0, 30)))})`);
}
const NOTIF_CAT = ['documentos', 'escalas', 'onboarding', 'sistema'];
const notifRows = [];
for (let i = 0; i < N_NOTIF; i++) {
  const p = pick(r, profiles);
  notifRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(p.id)}, ${q(pick(r, NOTIF_CAT))}, ${q(LG + ' ' + pick(r, ['Documento pendente de aprovação', 'Nova escala publicada', 'Tarefa de onboarding vencendo', 'Atualização do sistema']))}, ${q('Detalhe da notificação #' + i)}, false, ${q(daysAgo(r, rint(r, 0, 20)))})`);
}
const HR_Q = [
  ['Como solicito minhas férias?', false], ['Onde vejo meu holerite deste mês?', false],
  ['Meu ponto de ontem não registrou', false], ['Quais benefícios eu tenho direito?', false],
  ['Posso trabalhar de casa na sexta?', false], ['Preciso enviar um atestado médico', false],
  ['Quero conversar com alguém do RH sobre meu salário', true], ['Tenho uma reclamação sobre meu gestor', true],
];
const convRows = [];
const msgRows = [];
for (let i = 0; i < N_CONVERSATIONS; i++) {
  const p = pick(r, profiles.filter((x) => x.status === 'active'));
  const [qtext, escala] = pick(r, HR_Q);
  const cid = randomUUID();
  const status = escala ? 'escalated' : r() < 0.6 ? 'resolved' : 'open';
  const when = daysAgo(r, rint(r, 0, 30));
  convRows.push(`(${q(cid)}, ${q(TENANT)}, ${q(p.id)}, ${q(LG + ' ' + qtext.slice(0, 60))}, ${q(status)}, ${q(when)}, ${q(when)})`);
  msgRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(cid)}, 'user', ${q(qtext)}, ${q(when)})`);
  msgRows.push(`(${q(randomUUID())}, ${q(TENANT)}, ${q(cid)}, 'assistant', ${q(escala ? 'Vou encaminhar isso pro time de RH — logo alguém te retorna.' : 'Segue a orientação conforme a política interna. Qualquer dúvida, é só chamar.')}, ${q(when)})`);
}

const chunk4 = `
insert into audit_logs (id, tenant_id, actor_id, action, entity_type, ip_address, created_at) values
${auditRows.join(',\n')};

insert into notifications (id, tenant_id, profile_id, category, title, message, read, created_at) values
${notifRows.join(',\n')};

insert into hr_conversations (id, tenant_id, profile_id, subject, status, last_message_at, created_at) values
${convRows.join(',\n')};

insert into hr_messages (id, tenant_id, conversation_id, role, body, created_at) values
${msgRows.join(',\n')};
`;

// ── Executa ────────────────────────────────────────────────────────────────
const chunks = [
  ['1/4 limpeza + departamentos + 100 auth.users + profiles + hierarquia', chunk1],
  ['2/4 10 vagas + 220 candidatos + 35 entrevistas', chunk2],
  ['3/4 25 onboardings + tarefas + 140 escalas + 55 documentos + 6 treinamentos + progresso', chunk3],
  ['4/4 500 audit logs + 45 notificações + 40 conversas RH + mensagens', chunk4],
];

for (const [label, body] of chunks) {
  process.stdout.write(`→ ${label} ... `);
  try {
    await sql(body);
    console.log('ok');
  } catch (err) {
    console.log('FALHOU');
    console.error(`\n${err.message}\n`);
    console.error('⚠️  Pare aqui e me mande esse erro. O trigger on_auth_user_created volta ligado sozinho (rollback).');
    process.exit(1);
  }
}

console.log('\n✅ Carga aplicada no tenant demo. Rode agora: node scripts/smoke-test-dashboard.mjs');
