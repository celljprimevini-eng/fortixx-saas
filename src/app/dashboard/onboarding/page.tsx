import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onboarding · Fortixx',
  description: 'Acompanhe o onboarding dos novos colaboradores.',
};

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
      <div className="view-head">
        <div>
          <h1 className="view-title">Onboarding</h1>
          <p className="view-sub">Acompanhe novos colaboradores em tempo real.</p>
        </div>
        <button className="btn btn-primary btn-sm">+ Novo onboarding</button>
      </div>

      <div style={{ marginTop: 32 }}>
        <div className="kpi-grid">
          <div className="kpi-card glass accent-blue">
            <div className="kpi-top"><span className="kpi-label">Em andamento</span></div>
            <div className="kpi-value">0</div>
          </div>
          <div className="kpi-card glass accent-gold">
            <div className="kpi-top"><span className="kpi-label">Concluídos este mês</span></div>
            <div className="kpi-value">0</div>
          </div>
          <div className="kpi-card glass">
            <div className="kpi-top"><span className="kpi-label">Pendentes</span></div>
            <div className="kpi-value">0</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            textAlign: 'center',
          }}
          className="glass"
        >
          <p className="muted">Nenhum onboarding ativo no momento.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
            Iniciar primeiro onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
