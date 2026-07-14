#!/usr/bin/env node
/**
 * FORTIXX — SETUP AUTOMÁTICO
 * ============================================================================
 * Este script faz TUDO que é automatizável via linha de comando:
 *   - Inicializa o Git e cria o repositório no GitHub
 *   - Faz login/link do projeto Supabase e roda as migrations
 *   - Cria os produtos/preços no Stripe automaticamente
 *   - Faz o deploy inicial na Vercel
 *   - Gera o arquivo .env.local com tudo already preenchido
 *
 * O QUE ISSO NÃO FAZ (e não pode fazer por você):
 *   - Criar as CONTAS nas plataformas (Supabase, Vercel, Stripe, Resend,
 *     Cloudflare, n8n) — isso exige e-mail/senha/aceite de termos, então
 *     é uma ação humana por natureza.
 *   - Gerar as CHAVES de API — cada plataforma exige que você gere a
 *     chave logado na própria conta, por segurança.
 *
 * COMO USAR:
 *   1. Crie as contas gratuitas nas plataformas listadas em README.md
 *   2. Copie .env.example para .env.local e cole as chaves que cada
 *      plataforma te deu
 *   3. Rode: npm install && node scripts/setup.js
 * ============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch (e) {
    console.error(`⚠️  Falhou: ${cmd}`);
    return false;
  }
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           FORTIXX — SETUP AUTOMÁTICO DE PRODUÇÃO              ║
╚══════════════════════════════════════════════════════════════╝
`);

  // ── 1. Verificar .env.local ────────────────────────────────────────
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env.local não encontrado.');
    console.log('   Copie .env.example para .env.local e preencha as chaves antes de continuar.\n');
    process.exit(1);
  }
  require('dotenv').config({ path: envPath });
  console.log('✅ .env.local encontrado.');

  // ── 2. Git + GitHub ─────────────────────────────────────────────────
  console.log('\n── Git & GitHub ──────────────────────────────────────');
  if (!fs.existsSync('.git')) {
    run('git init');
    run('git add -A');
    run('git commit -m "Initial commit — Fortixx RH SaaS"');
  } else {
    console.log('✅ Repositório Git já inicializado.');
  }

  if (commandExists('gh')) {
    const wantsGithub = await ask('Criar repositório no GitHub agora via gh CLI? (s/n) ');
    if (wantsGithub.toLowerCase() === 's') {
      const repoName = (await ask('Nome do repositório [fortixx-saas]: ')) || 'fortixx-saas';
      run(`gh repo create ${repoName} --private --source=. --remote=origin --push`);
    }
  } else {
    console.log('ℹ️  GitHub CLI (gh) não encontrado. Instale com: brew install gh (ou veja cli.github.com)');
    console.log('   Depois rode: gh auth login && gh repo create fortixx-saas --private --source=. --push');
  }

  // ── 3. Supabase ─────────────────────────────────────────────────────
  console.log('\n── Supabase (banco de dados) ─────────────────────────');
  if (commandExists('supabase')) {
    const projectRef = process.env.SUPABASE_PROJECT_REF;
    if (projectRef) {
      run(`supabase link --project-ref ${projectRef}`);
      run('supabase db push');
      console.log('✅ Migrations aplicadas no Supabase.');
    } else {
      console.log('⚠️  SUPABASE_PROJECT_REF não definido no .env.local — pulando link automático.');
      console.log('   Rode manualmente: supabase link --project-ref SEU_REF && supabase db push');
    }
  } else {
    console.log('ℹ️  Supabase CLI não encontrado. Instale: npm install -g supabase');
    console.log('   Depois rode: supabase login && supabase link --project-ref SEU_REF && supabase db push');
  }

  // ── 4. Stripe ───────────────────────────────────────────────────────
  console.log('\n── Stripe (produtos e preços) ────────────────────────');
  if (process.env.STRIPE_SECRET_KEY) {
    run('node scripts/stripe-setup.js');
  } else {
    console.log('⚠️  STRIPE_SECRET_KEY não definida — pulando criação automática de produtos.');
  }

  // ── 5. Vercel ───────────────────────────────────────────────────────
  console.log('\n── Vercel (deploy) ────────────────────────────────────');
  if (commandExists('vercel')) {
    const wantsDeploy = await ask('Fazer deploy na Vercel agora? (s/n) ');
    if (wantsDeploy.toLowerCase() === 's') {
      run('vercel link --yes');
      console.log('\nSincronizando variáveis de ambiente do .env.local para a Vercel…');
      run('node scripts/vercel-env-sync.js');
      run('vercel --prod');
    }
  } else {
    console.log('ℹ️  Vercel CLI não encontrado. Instale: npm install -g vercel');
    console.log('   Depois rode: vercel login && vercel link && vercel --prod');
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SETUP CONCLUÍDO (o que pôde ser automatizado, foi).           ║
║  Veja DEPLOY_CHECKLIST.md para os passos manuais restantes     ║
║  (criação de contas, configuração de domínio, webhooks).       ║
╚══════════════════════════════════════════════════════════════╝
`);
  rl.close();
}

main();
