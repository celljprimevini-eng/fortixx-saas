import crypto from 'crypto';

/**
 * Integração com a Cakto (checkout hospedado + webhook).
 *
 * Modelo de uso — como Hotmart/Kiwify:
 *  1. Você cria na Cakto um produto de ASSINATURA com oferta de cartão de
 *     crédito recorrente e copia o link de checkout dessa oferta.
 *  2. Coloca esse link em CAKTO_CHECKOUT_URL.
 *  3. Na área de Webhooks do produto, aponta pra
 *     https://SEU_DOMINIO/api/cakto/webhook e copia o "secret" gerado pra
 *     CAKTO_WEBHOOK_SECRET.
 *
 * O webhook é a fonte de verdade do status da assinatura. O retorno do
 * checkout no front NUNCA libera acesso sozinho.
 *
 * Docs: https://docs.cakto.com.br/conceitos/webhooks
 */

export const CAKTO_ENABLED =
  !!process.env.CAKTO_CHECKOUT_URL && !!process.env.CAKTO_WEBHOOK_SECRET;

/** Eventos da Cakto que consideramos "assinatura ativa". */
const ACTIVE_EVENTS = new Set([
  'purchase_approved',
  'subscription_created',
  'subscription_renewed',
  'subscription_resumed',
]);

/** Eventos que derrubam o acesso. */
const CANCEL_EVENTS = new Set([
  'subscription_canceled',
  'subscription_paused',
  'refund',
  'chargeback',
]);

/** Eventos de falha de cobrança (mantém acesso, mas marca pendência). */
const PAST_DUE_EVENTS = new Set([
  'subscription_renewal_refused',
  'purchase_refused',
]);

export type CaktoOutcome = 'active' | 'canceled' | 'past_due' | 'ignore';

export function caktoEventOutcome(event: string): CaktoOutcome {
  if (ACTIVE_EVENTS.has(event)) return 'active';
  if (CANCEL_EVENTS.has(event)) return 'canceled';
  if (PAST_DUE_EVENTS.has(event)) return 'past_due';
  return 'ignore';
}

/**
 * Valida a origem do webhook. A Cakto oferece dois caminhos; suportamos
 * os dois:
 *  - header X-Cakto-Signature = "v1=<hmac_sha256(timestamp + '.' + body)>"
 *  - campo `secret` no corpo (comparação constante)
 */
export function verifyCaktoWebhook(args: {
  rawBody: string;
  bodySecret?: string | null;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
}): boolean {
  const secret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!secret) return false;

  const { rawBody, bodySecret, signatureHeader, timestampHeader } = args;

  // caminho 1: assinatura no header
  if (signatureHeader && timestampHeader) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest('hex');
    const got = signatureHeader.replace(/^v1=/, '');
    if (safeEqual(got, expected)) return true;
  }

  // caminho 2: secret no corpo
  if (bodySecret) return safeEqual(bodySecret, secret);

  return false;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Monta a URL de checkout da Cakto pro tenant. Passamos o id do tenant em
 * `sck` e `utm_content` — a Cakto devolve esses campos no webhook, então
 * conseguimos casar o pagamento com a empresa certa (com fallback pelo
 * e-mail do cliente).
 */
export function buildCaktoCheckoutUrl(args: {
  tenantId: string;
  email?: string | null;
  name?: string | null;
}): string | null {
  const base = process.env.CAKTO_CHECKOUT_URL;
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('sck', args.tenantId);
  url.searchParams.set('utm_content', args.tenantId);
  if (args.email) url.searchParams.set('email', args.email);
  if (args.name) url.searchParams.set('name', args.name);
  return url.toString();
}

/** Tenta achar o id do tenant no payload (tracking) — vários formatos possíveis. */
export function tenantIdFromCaktoPayload(data: any): string | null {
  const candidates = [
    data?.tracking?.sck,
    data?.tracking?.utm_content,
    data?.sck,
    data?.utm_content,
    data?.checkout?.sck,
    data?.checkout?.utm_content,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^[0-9a-f-]{36}$/i.test(c)) return c;
  }
  return null;
}

/** Mapeia a oferta da Cakto pro nosso plano interno. */
export function mapCaktoOfferToPlan(offerId?: string | null): 'basico' | 'pro' | 'enterprise' {
  if (offerId && offerId === process.env.CAKTO_OFFER_PRO) return 'pro';
  if (offerId && offerId === process.env.CAKTO_OFFER_ENTERPRISE) return 'enterprise';
  return 'basico';
}
