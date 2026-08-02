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

  // Rotas /auth/* são pra usuário DESLOGADO (login/register).
  // Exceções (rotas que precisam de user logado):
  //   /auth/verify      → challenge 2FA (após login com TOTP enrolled)
  //   /auth/setup-2fa   → setup inicial de TOTP (após login sem 2FA)
  // Se user tá logado e acessa /auth/login ou /auth/register → /dashboard
  const allowedAuthRoutesWhileLoggedIn = ['/auth/verify', '/auth/setup-2fa'];
  if (
    isAuthRoute &&
    user &&
    !allowedAuthRoutesWhileLoggedIn.some((p) => request.nextUrl.pathname.startsWith(p))
  ) {
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
