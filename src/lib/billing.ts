/**
 * Paywall — decide se a empresa (tenant) pode usar a área logada.
 *
 * Desligado por padrão: só bloqueia quando BILLING_ENFORCED=true na Vercel.
 * Assim o deploy não tranca ninguém (inclusive o tenant demo) antes de você
 * conferir o status de assinatura de cada empresa no banco.
 *
 * Regra:
 *  - active   → libera
 *  - past_due → libera (carência enquanto Stripe/Cakto tentam cobrar de novo;
 *               o dashboard já mostra o aviso de pagamento pendente)
 *  - trialing → libera até trial_ends_at
 *  - qualquer outro (canceled, unpaid, incomplete, paused...) → bloqueia
 */
export const BILLING_ENFORCED = process.env.BILLING_ENFORCED === 'true';

export interface TenantBilling {
  subscription_status: string | null;
  trial_ends_at: string | null;
}

export function hasActiveAccess(tenant: TenantBilling | null | undefined, now = new Date()): boolean {
  if (!tenant) return false;
  switch (tenant.subscription_status) {
    case 'active':
    case 'past_due':
      return true;
    case 'trialing':
      return !tenant.trial_ends_at || new Date(tenant.trial_ends_at) > now;
    default:
      return false;
  }
}

/** true quando o paywall está ligado e a empresa não tem acesso. */
export function isBlockedByPaywall(tenant: TenantBilling | null | undefined): boolean {
  return BILLING_ENFORCED && !hasActiveAccess(tenant);
}
