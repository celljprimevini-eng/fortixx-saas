'use client';

import { useState } from 'react';

/**
 * Botões de checkout da página /assinatura. Só redirecionam pro checkout
 * hospedado — quem libera o acesso é o webhook do provedor.
 */
export default function CheckoutButtons({
  caktoEnabled,
  stripeEnabled,
}: {
  caktoEnabled: boolean;
  stripeEnabled: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function go(provider: 'cakto' | 'stripe') {
    setLoading(provider);
    setError('');
    try {
      const res = await fetch(`/api/${provider}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: provider === 'stripe' ? JSON.stringify({ plan: 'pro' }) : '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível abrir o checkout.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o checkout.');
      setLoading(null);
    }
  }

  if (!caktoEnabled && !stripeEnabled) {
    return (
      <p className="login-sub">
        Nenhum meio de pagamento está configurado. Fale com o suporte da Fortixx.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {caktoEnabled && (
        <button className="btn btn-primary" disabled={!!loading} onClick={() => go('cakto')}>
          {loading === 'cakto' ? 'Abrindo…' : 'Assinar com cartão (recorrente)'}
        </button>
      )}
      {stripeEnabled && (
        <button className="btn btn-ghost" disabled={!!loading} onClick={() => go('stripe')}>
          {loading === 'stripe' ? 'Abrindo…' : 'Assinar pelo Stripe'}
        </button>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
