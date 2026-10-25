import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type Role = 'admin' | 'rh' | 'gestor' | 'colaborador';

export interface SessionProfile {
  id: string;
  tenant_id: string;
  role: Role;
  full_name: string;
}

/**
 * Sessão + perfil do usuário logado, pra rotas de API.
 *
 * Retorna `{ profile }` ou `{ error }` (uma NextResponse 401/403 pronta pra
 * devolver). Se `roles` vier, exige que o papel do usuário esteja nela.
 *
 *   const auth = await requireProfile(['admin', 'rh']);
 *   if ('error' in auth) return auth.error;
 *   const { profile } = auth;
 */
export async function requireProfile(
  roles?: readonly Role[],
): Promise<{ profile: SessionProfile } | { error: NextResponse }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id, role, full_name, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status === 'inactive') {
    return { error: NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 }) };
  }
  if (roles && !roles.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Sem permissão para esta ação.' }, { status: 403 }) };
  }

  return {
    profile: {
      id: profile.id,
      tenant_id: profile.tenant_id,
      role: profile.role,
      full_name: profile.full_name,
    },
  };
}

/** RH e admin moderam e decidem; gestor só aprova pedidos de férias. */
export const isHr = (role: Role) => role === 'admin' || role === 'rh';

export const badRequest = (msg = 'Dados inválidos.') =>
  NextResponse.json({ error: msg }, { status: 400 });

export const serverError = (msg = 'Falha ao salvar.') =>
  NextResponse.json({ error: msg }, { status: 500 });
