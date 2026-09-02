#!/usr/bin/env node
/**
 * Teste pesado do dashboard sem logar: roda contra o banco de produção as
 * mesmas consultas que /dashboard/platform faz, confere tabelas/colunas/FKs/
 * RLS, mede o volume da carga demo e testa o matcher de FAQ do Assistente RH.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/smoke-test-dashboard.mjs
 */

import { sql, TENANT } from './_lib.mjs';

let pass = 0, fail = 0;
const problems = [];

async function check(label, query, min = null) {
  try {
    const rows = await sql(query);
    const n = Array.isArray(rows) && rows[0] ? Number(rows[0].count ?? rows[0].n ?? 0) : 0;
    if (min != null && n < min) {
      console.log(`  ⚠️  ${label} — ${n} (esperava >= ${min})`);
      problems.push(`${label}: ${n} < ${min}`);
      fail++;
    } else {
      console.log(`  ✓  ${label} — ${n}`);
      pass++;
    }
  } catch (err) {
    console.log(`  ✗  ${label} — ${err.message.split('\n')[0]}`);
    problems.push(`${label}: ${err.message.split('\n')[0]}`);
    fail++;
  }
}
const T = (t, where = '') => `select count(*)::int as count from ${t} where tenant_id='${TENANT}' ${where}`;

console.log('\n══ 1. Tabelas existem (17) ══');
const tables = ['tenants', 'profiles', 'departments', 'job_openings', 'candidates', 'onboardings', 'onboarding_tasks', 'documents', 'schedules', 'audit_logs', 'notifications', 'interviews', 'trainings', 'training_progress', 'hr_faqs', 'hr_conversations', 'hr_messages'];
await check('17 tabelas presentes', `select count(*)::int as count from information_schema.tables where table_schema='public' and table_name in (${tables.map((t) => `'${t}'`).join(',')})`, 17);

console.log('\n══ 2. Volume da carga demo (tenant Fortixx) ══');
await check('profiles (colaboradores)', T('profiles'), 90);
await check('profiles ativos', T('profiles', "and status='active'"), 70);
await check('profiles com manager_id (organograma)', T('profiles', 'and manager_id is not null'), 80);
await check('departments', T('departments'), 6);
await check('job_openings', T('job_openings'), 10);
await check('job_openings abertas', T('job_openings', "and status='open'"), 5);
await check('candidates', T('candidates'), 200);
await check('candidates em entrevista (aprovações)', T('candidates', "and stage='entrevista'"), 5);
await check('candidates aprovados', T('candidates', "and stage='aprovado'"), 5);
await check('interviews', T('interviews'), 20);
await check('onboardings em andamento', T('onboardings', "and status='em_andamento'"), 20);
await check('onboarding_tasks', `select count(*)::int as count from onboarding_tasks where onboarding_id in (select id from onboardings where tenant_id='${TENANT}')`, 80);
await check('schedules (mês)', T('schedules'), 100);
await check('documents', T('documents'), 40);
await check('trainings', T('trainings'), 6);
await check('training_progress', T('training_progress'), 200);
await check('audit_logs (30d)', T('audit_logs'), 400);
await check('notifications não lidas', T('notifications', 'and read=false'), 40);
await check('hr_faqs', T('hr_faqs'), 8);
await check('hr_conversations', T('hr_conversations'), 35);
await check('hr_conversations escaladas', T('hr_conversations', "and status='escalated'"), 1);
await check('hr_messages', T('hr_messages'), 70);

console.log('\n══ 3. Consultas exatas do route.ts (com joins) ══');
await check('Diretório + depto (join departments)', `select count(*)::int as count from profiles p left join departments d on d.id=p.department_id where p.tenant_id='${TENANT}'`, 90);
await check('Organograma (self-join manager)', `select count(*)::int as count from profiles p left join profiles m on m.id=p.manager_id where p.tenant_id='${TENANT}'`, 90);
await check('Escalas + nome (join profiles)', `select count(*)::int as count from schedules s join profiles pr on pr.id=s.profile_id where s.tenant_id='${TENANT}'`, 100);
await check('Pipeline candidatos + vaga (join job_openings)', `select count(*)::int as count from candidates c left join job_openings j on j.id=c.job_opening_id where c.tenant_id='${TENANT}'`, 200);
await check('Entrevistas + candidato + entrevistador (2 joins)', `select count(*)::int as count from interviews i join candidates ca on ca.id=i.candidate_id left join profiles pi on pi.id=i.interviewer_id where i.tenant_id='${TENANT}'`, 20);
await check('Onboarding + pessoa + tasks', `select count(*)::int as count from onboardings o join profiles pr on pr.id=o.profile_id join onboarding_tasks t on t.onboarding_id=o.id where o.tenant_id='${TENANT}'`, 80);
await check('Documentos + pessoa', `select count(*)::int as count from documents d left join profiles pr on pr.id=d.profile_id where d.tenant_id='${TENANT}'`, 40);
await check('Treinamentos + progresso agregado', `select count(*)::int as count from trainings t left join training_progress tp on tp.training_id=t.id where t.tenant_id='${TENANT}'`, 200);
await check('Audit + ator (join profiles)', `select count(*)::int as count from audit_logs a left join profiles pr on pr.id=a.actor_id where a.tenant_id='${TENANT}'`, 400);
await check('Assistente Histórico + pessoa', `select count(*)::int as count from hr_conversations hc join profiles pr on pr.id=hc.profile_id where hc.tenant_id='${TENANT}'`, 35);

console.log('\n══ 4. Métricas que o dashboard calcula ══');
try {
  const growth = await sql(`select date_trunc('month', created_at)::date as mes, count(*)::int as n from profiles where tenant_id='${TENANT}' group by 1 order by 1`);
  console.log(`  ✓  Crescimento do quadro: ${growth.length} meses de dado (headcount chart)`);
  pass++;
  const funnel = await sql(`select stage, count(*)::int as n from candidates where tenant_id='${TENANT}' group by stage order by 2 desc`);
  console.log(`  ✓  Funil recrutamento: ${funnel.map((f) => `${f.stage}=${f.n}`).join(' · ')}`);
  pass++;
  const byDept = await sql(`select d.name, count(p.*)::int as n from profiles p join departments d on d.id=p.department_id where p.tenant_id='${TENANT}' group by d.name order by 2 desc`);
  console.log(`  ✓  Headcount por área: ${byDept.map((x) => `${x.name}=${x.n}`).join(' · ')}`);
  pass++;
  const hire = await sql(`select round(avg(extract(epoch from (updated_at-created_at))/86400))::int as dias from candidates where tenant_id='${TENANT}' and stage='aprovado'`);
  console.log(`  ✓  Tempo médio de contratação: ${hire[0]?.dias ?? '—'} dias`);
  pass++;
} catch (err) {
  console.log(`  ✗  métricas — ${err.message.split('\n')[0]}`);
  problems.push(`métricas: ${err.message.split('\n')[0]}`);
  fail++;
}

console.log('\n══ 5. RLS ligado nas tabelas novas ══');
await check('RLS em interviews/trainings/training_progress/hr_*', `select count(*)::int as count from pg_class where relname in ('interviews','trainings','training_progress','hr_faqs','hr_conversations','hr_messages') and relrowsecurity=true`, 6);

console.log('\n══ 6. Matcher de FAQ (Assistente RH, modo grátis) ══');
// reimplementação mínima do responder pra não importar .ts
const STOP = new Set('a o os as um uma de do da dos das e ou que em no na nos nas para pra por com sem meu minha meus minhas eu me se ao aos como qual quais quando onde quanto quantos quantas ser tem ter tenho temos vou ja ainda fazer faco isso esse essa este esta aqui ali sobre preciso quero gostaria poderia pode nao sim ok the is are my how what where'.split(' '));
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const faqRows = await sql(`select question, answer from hr_faqs where tenant_id='${TENANT}'`);
const faqs = (Array.isArray(faqRows) ? faqRows : []).map((f) => new Set([...norm(f.question), ...norm(f.answer)]));
function answers(msg) {
  const asked = norm(msg);
  let best = 0;
  for (const set of faqs) { const s = asked.filter((t) => set.has(t)).length / (asked.length || 1); if (s > best) best = s; }
  return best >= 0.33;
}
const casos = [['quero tirar minhas ferias', true], ['onde acho meu holerite do mes', true], ['meu ponto de ontem ta errado', true], ['tenho vale refeicao?', true], ['como mando um atestado', true], ['qual a capital da franca', false], ['quero pedir demissao', false]];
for (const [msg, shouldAnswer] of casos) {
  const ok = answers(msg) === shouldAnswer;
  console.log(`  ${ok ? '✓' : '✗'}  "${msg}" → ${answers(msg) ? 'responde pela base' : 'escala pro RH'}`);
  ok ? pass++ : (fail++, problems.push(`FAQ "${msg}"`));
}

console.log('\n' + '═'.repeat(52));
console.log(`${pass} OK · ${fail} problema(s)`);
if (problems.length) {
  console.log('\nProblemas:');
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exit(1);
}
console.log('✅ Dashboard passou no teste pesado — volume de ~100 pessoas, todas as seções com dado real.');
