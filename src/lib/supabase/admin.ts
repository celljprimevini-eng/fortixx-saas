import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase com a service_role key — BYPASSA o Row Level Security.
 *
 * ⚠️ NUNCA importe este arquivo em código que roda no navegador.
 * ⚠️ NUNCA exponha SUPABASE_SERVICE_ROLE_KEY com o prefixo NEXT_PUBLIC_.
 *
 * Uso legítimo (e único) deste cliente:
 * - Portal público de candidaturas (candidato não está autenticado,
 *   mas precisa poder criar um registro de candidate)
 * - Webhooks (Stripe, n8n) que precisam escrever dados de qualquer tenant
 * - Jobs administrativos internos
 *
 * Qualquer outra leitura/escrita de dados de negócio deve usar
 * src/lib/supabase/server.ts (respeita RLS) ou client.ts.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
