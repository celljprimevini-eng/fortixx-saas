import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasActiveAccess } from '@/lib/billing';
import { CAKTO_ENABLED } from '@/lib/cakto/client';
import { Logo } from '@/components/Logo';
import SignOutButton from '@/components/dashboard/sign-out-button';
import CheckoutButtons from './checkout-buttons';

/**
 * Destino do paywall (src/lib/billing.ts): a empresa está sem assinatura
 * ativa. Admin assina por aqui; os outros papéis veem o aviso pra falar com o
 * admin. O acesso volta sozinho quando o webhook do Stripe/Cakto confirmar o
 * pagamento.
 */
export default async function AssinaturaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenants(name, subscription_status, trial_ends_at)')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/auth/login');

  const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;
  if (hasActiveAccess(tenant)) redirect('/dashboard');

  const stripeEnabled = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
  const isAdmin = profile.role === 'admin';
  const reason =
    tenant?.subscription_status === 'trialing'
      ? 'O período de avaliação gratuita terminou.'
      : 'A assinatura da empresa não está ativa.';

  return (
    <>
      <header className="login-topbar">
        <a className="logo" href="/">
          <Logo />
        </a>
      </header>
      <main className="login-main">
        <div className="login-card-wrap">
          <div className="login-card glass">
            <div className="login-step active">
              <span className="login-eyebrow">{tenant?.name ?? 'Sua empresa'}</span>
              <h1 className="login-title">Assinatura necessária</h1>
              <p className="login-sub">
                {reason}{' '}
                {isAdmin
                  ? 'Assine para continuar usando a Fortixx — seus dados estão preservados.'
                  : 'Peça para o administrador da empresa regularizar a assinatura.'}
              </p>
              {isAdmin && (
                <CheckoutButtons caktoEnabled={CAKTO_ENABLED} stripeEnabled={stripeEnabled} />
              )}
              <div style={{ marginTop: 20 }}>
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
