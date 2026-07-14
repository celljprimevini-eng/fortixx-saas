import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para uso em Client Components (roda no navegador).
 * Usa a chave anon — segura para expor no front-end porque o RLS do
 * banco de dados é quem de fato protege os dados, não esta chave.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
