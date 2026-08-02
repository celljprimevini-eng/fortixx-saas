import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { check, getClientIp } from '@/lib/rate-limit';

/**
 * Sign-in centralizado (server-side) — permite aplicar rate limit
 * in-memory por IP+email antes de bater no Supabase Auth. Mitiga V1
 * do code review (brute force / credential stuffing, CVSS 7.5).
 *
 * Limitação conhecida: rate limit é in-memory, por-instância. Em
 * produção multi-instance o limite real fica `5 × N_instances`. A
 * troca por Upstash está documentada em `src/lib/rate-limit.ts`.
 *
 * Resposta de sucesso inclui `redirect` (cliente só faz router.push).
 * Sessão é gerenciada via cookies Supabase no próprio response — não
 * retornamos tokens nem dados sensíveis.
 */

const loginSchema = z.object({
  email: z.string().email('e-mail inválido').max(254).toLowerCase().trim(),
  password: z.string().min(1, 'senha obrigatória').max(200, 'senha longa demais'),
});

const RATE_LIMIT = 5;          // requests permitidos
const WINDOW_MS = 60_000;       // por minuto

export async function POST(req: NextRequest) {
  // 1. Parse + validação de input (fail-closed)
  const raw = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // 2. Rate limit por IP+email (key estável, lowercase)
  const ip = getClientIp(req.headers);
  const key = `login:${ip}:${email}`;
  const limit = check(key, RATE_LIMIT, WINDOW_MS);

  if (!limit.ok) {
    // 429 + Retry-After em segundos (RFC 6585)
    const retryAfter = Math.ceil(limit.resetMs / 1000);
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // 3. Sign-in via Supabase (server client lê cookies, vai setar os cookies de sessão)
  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    // Mesma resposta genérica — não vaza qual campo falhou.
    // Log server-side tem IP + email pra SOC/SIEM futuro (sem senha).
    console.warn(
      `[login] failed email=${email} ip=${ip} reason=${signInError.status ?? 'unknown'}`
    );
    return NextResponse.json(
      { error: 'E-mail ou senha incorretos.' },
      { status: 401 }
    );
  }

  // 4. Decide redirect:
  //    - Tem TOTP enrolled mas não verificado nesta sessão → /auth/verify (challenge)
  //    - Sem TOTP enrolled → /auth/setup-2fa (forçar setup antes do dashboard)
  //    - Tem TOTP verificado → /dashboard
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = factorsData?.totp?.some((f) => f.status === 'verified');
  const hasUnverifiedTotp = factorsData?.totp?.some((f) => f.status === 'unverified');
  let redirect: string;
  if (!hasVerifiedTotp && !hasUnverifiedTotp) {
    redirect = '/auth/setup-2fa'; // força setup inicial
  } else if (hasVerifiedTotp) {
    redirect = '/auth/verify'; // challenge
  } else {
    redirect = '/dashboard'; // fator não verificado (raro)
  }

  return NextResponse.json({ success: true, redirect });
}