#!/usr/bin/env node
/**
 * Envia todas as variáveis do .env.local para a Vercel automaticamente,
 * nos 3 ambientes (production, preview, development), sem precisar
 * colar uma por uma no painel da Vercel.
 *
 * Requer: vercel CLI instalada e `vercel link` já executado neste projeto.
 */
const { execSync } = require('child_process');
const fs = require('fs');

const envPath = '.env.local';
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local não encontrado.');
  process.exit(1);
}

const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
const envVars = lines
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const idx = line.indexOf('=');
    return { key: line.slice(0, idx), value: line.slice(idx + 1) };
  });

console.log(`Encontradas ${envVars.length} variáveis em .env.local\n`);

for (const { key, value } of envVars) {
  for (const target of ['production', 'preview', 'development']) {
    try {
      // Remove valor anterior (se existir) antes de adicionar, para evitar duplicatas
      execSync(`vercel env rm ${key} ${target} --yes`, { stdio: 'ignore' });
    } catch {
      // não existia antes — tudo bem
    }
    try {
      execSync(`echo "${value}" | vercel env add ${key} ${target}`, { stdio: 'ignore', shell: '/bin/bash' });
      console.log(`✅ ${key} → ${target}`);
    } catch (e) {
      console.log(`⚠️  Falha ao definir ${key} em ${target}`);
    }
  }
}

console.log('\n✅ Sincronização concluída. Rode `vercel --prod` para redeployar com as novas variáveis.');
