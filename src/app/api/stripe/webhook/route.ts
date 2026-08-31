import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, paymentFailedEmail } from '@/lib/resend/client';
import Stripe from 'stripe';

/**
 * Webhook do Stripe — a fonte de verdade sobre o status de assinatura
 * de cada tenant. NUNCA confie no retorno do Checkout no front-end para
 * liberar acesso; é este webhook, validado por assinatura criptográfica,
 * que efetivamente atualiza o banco.
 *
 * Eventos tratados:
 * - checkout.session.completed  → assinatura criada
 * - customer.subscription.updated → mudança de plano / renovação
 * - customer.subscription.deleted → cancelamento
 * - invoice.payment_failed → pagamento falhou (marca past_due, notifica)
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Assinatura de webhook Stripe inválida:', err);
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const tenantId = subscription.metadata.tenant_id;

      await supabase
        .from('tenants')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          plan: mapPriceToPlan(subscription.items.data[0].price.id),
        })
        .eq('id', tenantId);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata.tenant_id;

      await supabase
        .from('tenants')
        .update({
          subscription_status: subscription.status,
          plan: mapPriceToPlan(subscription.items.data[0].price.id),
        })
        .eq('id', tenantId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata.tenant_id;

      await supabase
        .from('tenants')
        .update({ subscription_status: 'canceled' })
        .eq('id', tenantId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const tenantId = subscription.metadata.tenant_id;

      await supabase.from('tenants').update({ subscription_status: 'past_due' }).eq('id', tenantId);

      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single();

      const { data: admin } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')
        .single();

      if (admin) {
        const { subject, html } = paymentFailedEmail(tenant?.name || 'sua empresa');
        await sendEmail({ to: admin.email, subject, html });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function mapPriceToPlan(priceId: string): 'basico' | 'pro' | 'enterprise' {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  return 'basico';
}
