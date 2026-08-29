import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware: renova a sessão do Supabase a cada requisição e protege
 * as rotas do dashboard. Sem isso, a sessão expiraria silenciosamente
 * e o usuário seria "deslogado" sem explicação.
 */
export async function middleware(request: NextRequest) {
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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
