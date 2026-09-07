#!/usr/bin/env node
/**
 * Cria uma conta de teste no Fortixx, já dentro do tenant DEMO
 * ("Fortixx Demo LTDA", com a carga de ~100 pessoas) e como admin — pra
 * um cliente entrar e testar o produto com dados de verdade.
 *
 * Não precisa do Access Token do Supabase: usa a Auth Admin API com a
 * SERVICE_ROLE_KEY que já está no .env.local.
 *
 * Uso:
 *   node scripts/create-test-account.mjs [email] [senha]
 * Sem argumentos: demo@fortixx.com.br + senha aleatória.
 *
 * Pra remover depois: apague o usuário em Supabase → Authentication → Users.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY || KEY.includes('dummy')) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes ou dummy no .env.local');
  process.exit(1);
}

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';
const EMAIL = (process.argv[2] || 'demo@fortixx.com.br').toLowerCase();
const PASSWORD = process.argv[3] || `Fortixx${Math.random().toString(36).slice(2, 8)}!${new Date().getFullYear()}`;

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function findUser(email) {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: h });
  const j = await r.json();
  return (j.users || []).find((u) => u.email === email) || null;
}

let uid;
const created = await fetch(`${URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { company_name: 'Fortixx Demo LTDA', full_name: 'Cliente Demo' },
  }),
});

if (created.ok) {
  uid = (await created.json()).id;
  console.log(`• usuário criado: ${EMAIL}`);
} else {
  const err = await created.json().catch(() => ({}));
  const existing = await findUser(EMAIL);
  if (!existing) {
    console.error('❌ criar usuário falhou:', err);
    process.exit(1);
  }
  uid = existing.id;
  console.log(`• usuário já existia — vou só reparentar e resetar a senha`);
  await fetch(`${URL}/auth/v1/admin/users/${uid}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
  });
}

// trigger on_auth_user_created cria tenant + profile — espera aparecer
let prof = null;
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 1200));
  const p = await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}&select=id,tenant_id,role`, { headers: h });
  const arr = await p.json().catch(() => []);
  if (Array.isArray(arr) && arr[0]) { prof = arr[0]; break; }
}
if (!prof) {
  console.error('❌ profile não apareceu (trigger on_auth_user_created não rodou?)');
  process.exit(1);
}

const junkTenant = prof.tenant_id;

// reparent pro tenant demo, como admin
const up = await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`, {
  method: 'PATCH',
  headers: { ...h, Prefer: 'return=minimal' },
  body: JSON.stringify({ tenant_id: DEMO_TENANT, role: 'admin', full_name: 'Cliente Demo' }),
});
if (!up.ok) {
  console.error('❌ reparent falhou:', await up.text());
  process.exit(1);
}
console.log('• profile movido pro tenant demo, role=admin');

// limpa o tenant vazio que o trigger criou (best-effort)
if (junkTenant && junkTenant !== DEMO_TENANT) {
  const del = await fetch(`${URL}/rest/v1/tenants?id=eq.${junkTenant}`, {
    method: 'DELETE',
    headers: { ...h, Prefer: 'return=minimal' },
  });
  console.log(del.ok ? '• tenant vazio removido' : `• tenant vazio deixado pra trás (${del.status}) — inofensivo`);
}

console.log('\n──────────────────────────────────────────────');
console.log('✅ CONTA DE TESTE PRONTA');
console.log('  Site:  https://fortixx-saas.vercel.app/auth/login');
console.log(`  Email: ${EMAIL}`);
console.log(`  Senha: ${PASSWORD}`);
console.log('  Empresa: Fortixx Demo LTDA (~100 colaboradores, escalas, vagas, etc.)');
console.log('  Papel: admin (vê tudo)');
console.log('');
console.log('  ⚠️  No 1º acesso o sistema OBRIGA cadastrar 2FA:');
console.log('      o cliente precisa de um app autenticador (Google Authenticator,');
console.log('      Authy, etc.) pra escanear o QR. Depois disso, todo login pede');
console.log('      o código de 6 dígitos.');
console.log('──────────────────────────────────────────────');
