import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para uso em Server Components, Route Handlers e
 * Server Actions. Lê/escreve a sessão via cookies do Next.js.
 *
 * IMPORTANTE: usa a chave anon (respeita RLS). Nunca importe a
 * service_role key aqui — ela é só para o server-admin.ts, usado
 * unicamente em rotas que precisam bypassar RLS de propósito
 * (ex.: portal público de candidaturas, webhooks).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component chamando set() fora de uma Server Action/Route
            // Handler — pode ser ignorado com segurança se o middleware
            // já cuida de refresh de sessão.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // idem acima
          }
        },
      },
    }
  );
}
