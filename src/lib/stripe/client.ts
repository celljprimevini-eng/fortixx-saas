import Stripe from 'stripe';

/**
 * Cliente Stripe com fallback gracioso: se STRIPE_SECRET_KEY não estiver
 * configurada, `getStripe()` retorna null e o caller deve decidir o que
 * fazer (ex: retornar 503 em vez de quebrar o build). O construtor do
 * Stripe não valida a key na instanciação, mas chamadas de API explodem
 * em runtime — mesma estratégia do `src/lib/resend/client.ts`.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
  return _stripe;
}

/**
 * @deprecated Use `getStripe()` para lazy init. Mantido temporariamente
 * para compatibilidade; será removido na próxima refatoração.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
  typescript: true,
});

/**
 * IDs de preço do Stripe — preenchidos automaticamente pelo
 * scripts/stripe-setup.js na primeira execução (ele cria os produtos
 * e preços no Stripe e grava os IDs no .env.local).
 */
export const STRIPE_PRICES = {
  basico: process.env.STRIPE_PRICE_BASICO!,
  pro: process.env.STRIPE_PRICE_PRO!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
} as const;
