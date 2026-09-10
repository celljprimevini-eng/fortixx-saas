import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Rate limit por IP — janela deslizante de 1 min, in-memory no isolate do
 * edge (best-effort, não substitui o WAF da Vercel). Serve pra cortar
 * flood ingênuo / scraping ANTES de bater no Supabase e evitar susto de
 * "40 mil requisições". Limites por classe de rota mais abaixo.
 */
const RL_BUCKETS = new Map<string, number[]>();
function rateLimited(key: string, maxPerMin: number): boolean {
  const now = Date.now();
  const cutoff = now - 60_000;
  const arr = (RL_BUCKETS.get(key) ?? []).filter((t) => t > cutoff);
  arr.push(now);
  RL_BUCKETS.set(key, arr);
  if (RL_BUCKETS.size > 5000) {
    for (const [k, v] of Array.from(RL_BUCKETS)) {
      if (!v.some((t) => t > cutoff)) RL_BUCKETS.delete(k);
    }
  }
  return arr.length > maxPerMin;
}

/**
 * Middleware: renova a sessão do Supabase a cada requisição e protege
 * as rotas do dashboard. Sem isso, a sessão expiraria silenciosamente
 * e o usuário seria "deslogado" sem explicação.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Público sem login → mais apertado (spam de candidatura, abuso do chat).
  const isPublicApi =
    path.startsWith('/api/recrutamento/apply') || path.startsWith('/api/hr-assistant');
  const isWebhookApi =
    path.startsWith('/api/stripe/webhook') ||
    path.startsWith('/api/cakto/webhook') ||
    path.startsWith('/api/webhooks/');
  if (!isWebhookApi) {
    const bucket = isPublicApi ? path : path.startsWith('/api/') ? 'api' : 'page';
    const max = isPublicApi ? 12 : path.startsWith('/api/') ? 90 : 240;
    if (rateLimited(`${ip}|${bucket}`, max)) {
      return path.startsWith('/api/')
        ? NextResponse.json(
            { error: 'Muitas requisições. Aguarde um minuto.' },
            { status: 429, headers: { 'retry-after': '60' } },
          )
        : new NextResponse('Muitas requisições. Aguarde um minuto.', {
            status: 429,
            headers: { 'retry-after': '60' },
          });
    }
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // ── Trava de origem cruzada nas rotas de escrita da API ───────────────────
  // Um clone do frontend hospedado em OUTRO domínio não consegue usar a
  // nossa API: o navegador manda o header `Origin` em toda requisição
  // POST/PUT/PATCH/DELETE cross-origin, e aqui rejeitamos se não for o
  // Fortixx. Webhooks (Stripe/Cakto/n8n) são server-to-server, sem Origin,
  // e já se validam por assinatura — ficam de fora.
  if (isApiRoute && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const isWebhook =
      request.nextUrl.pathname.startsWith('/api/stripe/webhook') ||
      request.nextUrl.pathname.startsWith('/api/cakto/webhook') ||
      request.nextUrl.pathname.startsWith('/api/webhooks/');
    if (!isWebhook) {
      const origin = request.headers.get('origin');
      const allowed = new Set(
        [
          request.nextUrl.origin,
          process.env.NEXT_PUBLIC_APP_URL,
          process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
          'https://fortixx-saas.vercel.app',
        ].filter(Boolean) as string[],
      );
      if (origin && !allowed.has(origin)) {
        return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
      }
    }
  }

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Enforça o challenge de 2FA no servidor: sem isso, um usuário com fator
  // TOTP cadastrado mas ainda não verificado nesta sessão (AAL1) conseguia
  // pular /auth/verify navegando direto pra /dashboard pela URL — o
  // redirect da rota de login era só uma sugestão pro client, não uma
  // barreira real.
  if (isDashboardRoute && user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/verify';
      return NextResponse.redirect(url);
    }
  }

  // Rotas /auth/* permitidas para usuário logado (precisam estar logado pra funcionar):
  //  - /auth/setup-2fa: usuário acabou de logar, precisa cadastrar TOTP
  //  - /auth/verify: challenge de TOTP em logins seguintes
  //  - /auth/reset-password: sessão temporária de recovery (link de "esqueci minha senha")
  // Qualquer OUTRA rota /auth/* (login, register) → redireciona pro dashboard
  const isAllowedAuthRoute =
    request.nextUrl.pathname.startsWith('/auth/setup-2fa') ||
    request.nextUrl.pathname.startsWith('/auth/verify') ||
    request.nextUrl.pathname.startsWith('/auth/reset-password');
  if (isAuthRoute && user && !isAllowedAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Anti-embed: só o /dashboard precisa ser carregado em iframe (same-origin,
  // ele mesmo carrega /dashboard/platform). Todo o resto — landing, login,
  // portais públicos — nunca deve ser iframável: fecha o vetor de um clone
  // "moldura" que embute o site real por baixo (clickjacking / phishing).
  // (X-Frame-Options: DENY é honrado pelo navegador independentemente da CSP
  // global — não sobrescrevemos a CSP aqui pra não perder script-src/style-src.)
  if (!isDashboardRoute && !isApiRoute) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
