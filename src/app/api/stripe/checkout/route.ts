import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe/client';

/**
 * Cria uma sessão de Checkout do Stripe para o tenant do usuário logado
 * assinar um plano. Chamada pelo botão "Começar agora" da página de Planos.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { plan } = (await req.json()) as { plan: keyof typeof STRIPE_PRICES };
  if (!STRIPE_PRICES[plan]) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, tenants(stripe_customer_id, name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });
  }

  // Cria (ou reaproveita) o Customer no Stripe
  let customerId = (profile.tenants as any)?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: (profile.tenants as any)?.name,
      metadata: { tenant_id: profile.tenant_id },
    });
    customerId = customer.id;
    await supabase
      .from('tenants')
      .update({ stripe_customer_id: customerId })
      .eq('id', profile.tenant_id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: STRIPE_PRICES[plan], quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
    subscription_data: {
      metadata: { tenant_id: profile.tenant_id },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
