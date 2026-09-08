#!/usr/bin/env node
/**
 * Apaga TODA a carga do activity-sim (marcada com [SIM] / SIM:) do tenant
 * demo. Não mexe em nada real. Usa só a SERVICE_ROLE_KEY.
 *
 *   node scripts/activity-sim-clean.mjs
 *
 * Pra parar de gerar carga nova: GitHub → Actions → activity-sim → Disable.
 */

import { SB_URL, H, rest } from './_env.mjs';

const T = '00000000-0000-0000-0000-000000000001';
const LIKE = 'like.%5BSIM%5D%25'; // [SIM]%

async function del(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  if (!r.ok && r.status !== 404) console.warn(`  ! DELETE ${path} → ${r.status}: ${await r.text()}`);
}
const ids = (arr) => `(${arr.map((x) => x.id).join(',')})`;

// filhos primeiro
const convs = await rest(`hr_conversations?select=id&tenant_id=eq.${T}&subject=${LIKE}`);
if (convs.length) {
  await del(`hr_messages?conversation_id=in.${ids(convs)}`);
  await del(`hr_conversations?id=in.${ids(convs)}`);
  console.log(`• ${convs.length} conversas RH`);
}

const simProfiles = await rest(`profiles?select=id&tenant_id=eq.${T}&full_name=${LIKE}`);
if (simProfiles.length) {
  await del(`schedules?profile_id=in.${ids(simProfiles)}`);
  await del(`documents?profile_id=in.${ids(simProfiles)}`);
  await del(`notifications?profile_id=in.${ids(simProfiles)}`);
  await del(`audit_logs?actor_id=in.${ids(simProfiles)}`);
}

await del(`audit_logs?tenant_id=eq.${T}&action=like.SIM:%25`);
await del(`notifications?tenant_id=eq.${T}&title=${LIKE}`);
await del(`documents?tenant_id=eq.${T}&file_name=${LIKE}`);
await del(`candidates?tenant_id=eq.${T}&full_name=${LIKE}`);

// perfis [SIM] admitidos: apaga o profile e o auth.user
for (const p of simProfiles) {
  await del(`profiles?id=eq.${p.id}`);
  await fetch(`${SB_URL}/auth/v1/admin/users/${p.id}`, { method: 'DELETE', headers: H }).catch(() => {});
}
if (simProfiles.length) console.log(`• ${simProfiles.length} perfis [SIM] (admissões) removidos`);

console.log('✅ carga do activity-sim limpa.');
