import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
