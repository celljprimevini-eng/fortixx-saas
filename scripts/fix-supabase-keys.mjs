#!/usr/bin/env node
/**
 * Conserta as chaves do Supabase que estão erradas/dummy no ambiente:
 * busca as chaves REAIS (anon + service_role) do projeto via Management API
 * (só com o Access Token) e grava:
 *   - no .env.local
 *   - na Vercel (production, preview, development)
 *
 * Motivo: o teste de produção mostrou que `SUPABASE_SERVICE_ROLE_KEY` na
 * Vercel não é a chave real — toda rota que usa createAdminClient()
 * (upload de documento, chat do Assistente RH, aprovar candidato, etc.)
 * falha com 500.
 *
 * Uso (PowerShell, na pasta principal/):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/fix-supabase-keys.mjs
 *
 * Depois: vercel --prod --yes
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'qgsbdwsqzmuxawiodjfr';

if (!TOKEN || !TOKEN.startsWith('sbp_')) {
  console.error('❌ Defina SUPABASE_ACCESS_TOKEN (sbp_...) no ambiente.');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (!res.ok) {
  console.error(`❌ Não consegui buscar as chaves (HTTP ${res.status}).`);
  process.exit(1);
}
const keys = await res.json();
const anon = keys.find((k) => k.name === 'anon')?.api_key;
const service = keys.find((k) => k.name === 'service_role')?.api_key;
if (!anon || !service) {
  console.error('❌ Resposta sem anon/service_role:', JSON.stringify(keys).slice(0, 200));
  process.exit(1);
}
console.log('✓ chaves reais obtidas (anon + service_role)');

const wanted = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  SUPABASE_PROJECT_REF: REF,
};

// ── .env.local ─────────────────────────────────────────────────────────────
if (existsSync('.env.local')) {
  let env = readFileSync('.env.local', 'utf8');
  for (const [k, v] of Object.entries(wanted)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    const line = `${k}=${k.startsWith('NEXT_PUBLIC_SUPABASE_URL') ? `"${v}"` : v}`;
    env = re.test(env) ? env.replace(re, line) : env + `\n${line}`;
  }
  writeFileSync('.env.local', env);
  console.log('✓ .env.local atualizado');
} else {
  console.log('· .env.local não existe — pulando');
}

// ── Vercel ─────────────────────────────────────────────────────────────────
function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
}
let vercelOk = true;
try { sh('vercel whoami'); } catch { vercelOk = false; }

if (!vercelOk) {
  console.log('\n⚠️  Vercel CLI não autenticada. Rode `vercel login` e depois este script de novo,');
  console.log('   ou defina as 2 chaves à mão no painel (Settings → Environment Variables).');
  process.exit(0);
}

for (const [k, v] of Object.entries(wanted)) {
  for (const target of ['production', 'preview', 'development']) {
    try { sh(`vercel env rm ${k} ${target} --yes`, { stdio: 'ignore' }); } catch {}
    try {
      sh(`vercel env add ${k} ${target}`, { input: v + '\n', stdio: ['pipe', 'ignore', 'ignore'] });
      console.log(`✓ ${k} → ${target}`);
    } catch {
      console.log(`⚠️  falhou: ${k} → ${target}`);
    }
  }
}

console.log('\n✅ Feito. Agora redeploye: vercel --prod --yes');
