import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CAKTO_ENABLED, buildCaktoCheckoutUrl } from '@/lib/cakto/client';

export const runtime = 'nodejs';

/**
 * Devolve a URL de checkout da Cakto pro tenant do usuário logado. O front
 * só precisa redirecionar (window.location = url).
 *
 * O acesso pago NÃO é liberado aqui — quem libera é /api/cakto/webhook.
 */
export async function POST(_req: NextRequest) {
  if (!CAKTO_ENABLED) {
    return NextResponse.json(
      { error: 'Cobrança pela Cakto não está configurada.' },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, tenants(name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });
  }

  const url = buildCaktoCheckoutUrl({
    tenantId: profile.tenant_id,
    email: user.email,
    name: (profile.tenants as any)?.name ?? null,
  });

  if (!url) {
    return NextResponse.json({ error: 'CAKTO_CHECKOUT_URL ausente.' }, { status: 503 });
  }

  return NextResponse.json({ url });
}
