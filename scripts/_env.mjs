// Config pros scripts que usam a SERVICE_ROLE_KEY (Auth Admin API + PostgREST),
// sem precisar do Access Token do Supabase.
// Ordem: process.env (CI) → .env.local (dev local).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let fileEnv = {};
try {
  fileEnv = Object.fromEntries(
    readFileSync(join(ROOT, '.env.local'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
} catch { /* sem .env.local — usa process.env (CI) */ }

export const env = { ...fileEnv, ...process.env };

export const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
export const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY || SB_KEY.includes('dummy')) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes ou dummy no .env.local');
  process.exit(1);
}

export const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

/** PostgREST GET → array */
export async function rest(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
  const j = await r.json();
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

/** PostgREST write */
export async function restWrite(method, path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { ...H, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${txt}`);
  return txt ? JSON.parse(txt) : null;
}
