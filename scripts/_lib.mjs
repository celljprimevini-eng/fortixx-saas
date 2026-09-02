// Utilitários compartilhados pelos scripts de teste/carga (seed-demo-load, smoke-test).
// Não é código de produção — só ferramenta de dev/QA.

export const REF = process.env.SUPABASE_PROJECT_REF || 'qgsbdwsqzmuxawiodjfr';
export const TENANT = '00000000-0000-0000-0000-000000000001';
export const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN || !TOKEN.startsWith('sbp_')) {
  console.error('❌ Defina SUPABASE_ACCESS_TOKEN (sbp_...) no ambiente.');
  process.exit(1);
}

export async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

// Escapa string pra literal SQL.
export const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// PRNG determinístico (mulberry32) — mesma carga toda vez que roda.
export function rng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const rint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// Data ISO N dias atrás (com hora aleatória).
export function daysAgo(r, n) {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(rint(r, 7, 20), rint(r, 0, 59), rint(r, 0, 59), 0);
  return d.toISOString();
}

export const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Paulo', 'Queila', 'Rafael', 'Sofia', 'Thiago', 'Ursula', 'Vitor', 'Wesley', 'Xavier', 'Yasmin', 'Zeca', 'Beatriz', 'Caio', 'Débora', 'Enzo'];
export const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Carvalho', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Araújo', 'Ribeiro', 'Barbosa', 'Rocha', 'Dias', 'Teixeira', 'Cardoso', 'Moreira', 'Gomes'];
