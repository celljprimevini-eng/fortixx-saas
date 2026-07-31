/**
 * Rate limiter in-memory com sliding window simples.
 *
 * ⚠️ MVP — em produção multi-instância (Vercel: várias lambdas em paralelo),
 * o limite real fica `5 × N_instances` req/periodo, porque cada lambda tem
 * o próprio Map. Pra fechar de verdade, trocar por:
 *
 *   import { Ratelimit } from '@upstash/ratelimit';
 *   import { Redis } from '@upstash/redis';
 *   const limiter = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '1 m') });
 *   const { success, remaining, reset } = await limiter.limit(key);
 *
 * A interface abaixo (`check(key, limit, windowMs)`) já é compatível com
 * essa migração — basta trocar a implementação interna do `check()`,
 * nenhum chamador precisa mudar.
 *
 * Cleanup oportunista: quando o Map passar de 10k chaves, varre e remove
 * entradas com timestamps todos fora da janela. Evita leak em uptime longo.
 */

const buckets = new Map<string, number[]>();

const CLEANUP_THRESHOLD = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

let lastSweep = Date.now();

function sweep() {
  const now = Date.now();
  // Sweep no máximo 1× por minuto
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const cutoff = now - SWEEP_INTERVAL_MS;
  for (const [key, timestamps] of Array.from(buckets)) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else if (fresh.length !== timestamps.length) {
      buckets.set(key, fresh);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Milissegundos até a janela liberar pelo menos 1 slot. */
  resetMs: number;
}

export function check(key: string, limit: number, windowMs: number): RateLimitResult {
  if (buckets.size > CLEANUP_THRESHOLD) sweep();

  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = buckets.get(key) ?? [];

  // Mantém só timestamps dentro da janela
  const fresh = timestamps.filter((t) => t > cutoff);

  if (fresh.length >= limit) {
    // Janela cheia — calcula quando o timestamp mais antigo expira
    const oldest = fresh[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, fresh);
    return { ok: false, remaining: 0, resetMs };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true, remaining: limit - fresh.length, resetMs: windowMs };
}

/**
 * Helper pra extrair IP do request — Vercel e Cloudflare setam
 * `x-forwarded-for` (lista, primeiro é o cliente real).
 * `x-real-ip` é fallback comum.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get('x-real-ip');
  if (xri) return xri.trim();
  return '0.0.0.0';
}