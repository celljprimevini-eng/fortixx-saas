#!/usr/bin/env node
/**
 * Aplica as migrations pendentes no Supabase via Management API — sem precisar
 * do Supabase CLI nem da senha do banco, só do Access Token (sbp_...).
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/apply-migrations.mjs
 *
 * Uso (bash):
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs
 *
 * Roda, em ordem: 0009_interviews, 0010_trainings, 0011_hr_assistant e um
 * seed idempotente de hr_faqs (8 perguntas) pro Assistente RH ter o que
 * responder. Cada passo é independente — se um falhar, os outros continuam e
 * o erro aparece no fim.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'qgsbdwsqdmuxawiodjfr';

if (!TOKEN || !TOKEN.startsWith('sbp_')) {
  console.error('❌ Defina SUPABASE_ACCESS_TOKEN (sbp_...) no ambiente antes de rodar.');
  process.exit(1);
}

const TENANT = '00000000-0000-0000-0000-000000000001';

const FAQ_SEED = `
insert into public.hr_faqs (tenant_id, question, answer, views)
select * from (values
  ('${TENANT}'::uuid, 'Como solicito minhas férias?', 'No Portal do Colaborador, em Solicitações > Nova solicitação > Férias. O pedido vai automaticamente pro seu gestor aprovar. Peça com pelo menos 30 dias de antecedência.', 142),
  ('${TENANT}'::uuid, 'Onde vejo meu holerite / contracheque?', 'Em Documentos, dentro do Portal do Colaborador. O holerite do mês fica disponível todo dia 5.', 98),
  ('${TENANT}'::uuid, 'Como corrijo um erro no meu ponto?', 'Abra uma solicitação de ajuste de ponto informando a data e o horário correto. Seu gestor recebe a aprovação automaticamente.', 71),
  ('${TENANT}'::uuid, 'Quais benefícios eu tenho?', 'Os benefícios ativos são: plano de saúde, vale-refeição, vale-alimentação e vale-transporte. Os detalhes de cada um estão em Documentos > Benefícios.', 64),
  ('${TENANT}'::uuid, 'Quantos dias de férias eu tenho acumulados?', 'O saldo exato aparece no Portal do Colaborador, na tela inicial. Cada 12 meses trabalhados dá direito a 30 dias.', 55),
  ('${TENANT}'::uuid, 'Como funciona o home office / trabalho remoto?', 'A política de trabalho remoto está em Documentos > Políticas. Combine o formato (presencial, híbrido ou remoto) com seu gestor.', 47),
  ('${TENANT}'::uuid, 'Como peço um atestado ou justifico uma falta?', 'Envie o atestado pelo Portal do Colaborador em até 48h, em Solicitações > Atestado. Faltas sem justificativa podem ser descontadas.', 39),
  ('${TENANT}'::uuid, 'Qual o horário de trabalho e a tolerância de entrada?', 'O horário padrão é de segunda a sexta, das 9h às 18h, com 1h de almoço. A tolerância é de 10 minutos na entrada.', 33)
) as v(tenant_id, question, answer, views)
where not exists (select 1 from public.hr_faqs where tenant_id = '${TENANT}'::uuid);
`;

const steps = [
  { name: '0009_interviews', sql: readFileSync(join(ROOT, 'supabase/migrations/0009_interviews.sql'), 'utf8') },
  { name: '0010_trainings', sql: readFileSync(join(ROOT, 'supabase/migrations/0010_trainings.sql'), 'utf8') },
  { name: '0011_hr_assistant', sql: readFileSync(join(ROOT, 'supabase/migrations/0011_hr_assistant.sql'), 'utf8') },
  { name: 'seed:hr_faqs', sql: FAQ_SEED },
];

const API = 'https://api.supabase.com/v1';
const auth = { Authorization: `Bearer ${TOKEN}` };

async function runSql(query) {
  const res = await fetch(`${API}/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

// Confirma que o REF existe e que o token enxerga ele. Se não, lista os
// projetos visíveis pra achar o ref certo.
{
  const res = await fetch(`${API}/projects`, { headers: auth });
  if (!res.ok) {
    console.error(`❌ Não consegui listar projetos (HTTP ${res.status}). Token inválido ou sem permissão.`);
    process.exit(1);
  }
  const projects = await res.json();
  const match = projects.find((p) => p.id === REF);
  console.log(`Projetos visíveis por este token:`);
  for (const p of projects) console.log(`  ${p.id === REF ? '→' : ' '} ${p.id}  ${p.name}  (org ${p.organization_id})`);
  if (!match) {
    console.error(`\n❌ O ref "${REF}" não está nos projetos acima. Rode de novo com o ref certo:`);
    console.error(`   $env:SUPABASE_PROJECT_REF="<ref-de-cima>"; $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/apply-migrations.mjs`);
    process.exit(1);
  }
  console.log('');
}

const failures = [];
for (const step of steps) {
  process.stdout.write(`→ ${step.name} ... `);
  try {
    await runSql(step.sql);
    console.log('ok');
  } catch (err) {
    console.log('FALHOU');
    console.log(`   ${err.message}`);
    failures.push(step.name);
  }
}

if (failures.length) {
  console.log(`\n⚠️  Falharam: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\n✅ Tudo aplicado. Entrevistas, Treinamentos e Assistente RH estão ligados.');
