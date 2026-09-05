import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, paymentFailedEmail } from '@/lib/resend/client';
import {
  verifyCaktoWebhook,
  caktoEventOutcome,
  tenantIdFromCaktoPayload,
  mapCaktoOfferToPlan,
} from '@/lib/cakto/client';

export const runtime = 'nodejs';

/**
 * Webhook da Cakto — fonte de verdade do status de assinatura do tenant
 * quando billing_provider = 'cakto'. Valida a origem (assinatura no header
 * ou secret no corpo) antes de mexer no banco.
 *
 * Eventos: purchase_approved, subscription_created/renewed/resumed → ativa;
 * subscription_canceled/paused, refund, chargeback → cancela;
 * subscription_renewal_refused, purchase_refused → past_due (+ e-mail).
 *
 * Casa o pagamento com a empresa por: tracking (sck/utm_content) →
 * fallback pelo e-mail do cliente.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const h = headers();

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const ok = verifyCaktoWebhook({
    rawBody,
    bodySecret: payload?.secret,
    signatureHeader: h.get('x-cakto-signature'),
    timestampHeader: h.get('x-cakto-timestamp'),
  });
  if (!ok) {
    console.error('[cakto] webhook com origem inválida');
    return NextResponse.json({ error: 'Origem inválida' }, { status: 401 });
  }

  const event: string = payload?.event ?? '';
  const data = payload?.data ?? {};
  const outcome = caktoEventOutcome(event);
  if (outcome === 'ignore') {
    return NextResponse.json({ received: true, ignored: event });
  }

  const supabase = createAdminClient();

  // 1) acha o tenant
  let tenantId = tenantIdFromCaktoPayload(data);
  const customerEmail: string | undefined = data?.customer?.email?.toLowerCase();

  if (!tenantId && customerEmail) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .ilike('email', customerEmail)
      .in('role', ['admin', 'rh'])
      .limit(1)
      .maybeSingle();
    tenantId = prof?.tenant_id ?? null;
  }

  if (!tenantId) {
    console.error('[cakto] não achei o tenant', { event, customerEmail });
    // 200 pra Cakto não ficar reenviando pra sempre — mas logamos.
    return NextResponse.json({ received: true, warning: 'tenant não encontrado' });
  }

  // 2) aplica o efeito
  const subId: string | null = data?.subscription?.id ?? data?.id ?? null;
  const offerId: string | null = data?.offer?.id ?? null;
  const custId: string | null = data?.customer?.id ? String(data.customer.id) : null;

  if (outcome === 'active') {
    await supabase
      .from('tenants')
      .update({
        billing_provider: 'cakto',
        subscription_status: 'active',
        plan: mapCaktoOfferToPlan(offerId),
        cakto_subscription_id: subId,
        cakto_customer_id: custId,
      })
      .eq('id', tenantId);
  } else if (outcome === 'canceled') {
    await supabase
      .from('tenants')
      .update({ subscription_status: 'canceled' })
      .eq('id', tenantId);
  } else if (outcome === 'past_due') {
    await supabase
      .from('tenants')
      .update({ subscription_status: 'past_due' })
      .eq('id', tenantId);

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();
    const { data: admin } = await supabase
      .from('profiles')
      .select('email')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    if (admin?.email) {
      const { subject, html } = paymentFailedEmail(tenant?.name || 'sua empresa');
      await sendEmail({ to: admin.email, subject, html });
    }
  }

  return NextResponse.json({ received: true, event, outcome, tenantId });
}
