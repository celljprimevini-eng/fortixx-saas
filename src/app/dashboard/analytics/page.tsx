import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics · Fortixx',
  description: 'Relatórios e indicadores de RH em tempo real.',
};

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
      <div className="view-head">
        <div>
          <h1 className="view-title">Analytics</h1>
          <p className="view-sub">Indicadores e relatórios de RH em tempo real.</p>
        </div>
        <button className="btn btn-ghost btn-sm">Exportar relatório</button>
      </div>

      <div className="kpi-grid" style={{ marginTop: 28 }}>
        {[
          { label: 'Taxa de turnover', value: '—', cor: 'accent-blue' },
          { label: 'Tempo médio de contratação', value: '—', cor: 'accent-gold' },
          { label: 'NPS interno', value: '—', cor: 'accent-blue' },
          { label: 'Absenteísmo', value: '—', cor: 'accent-warn' },
        ].map((k) => (
          <div key={k.label} className={`kpi-card glass ${k.cor}`}>
            <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 28,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 48,
          textAlign: 'center',
        }}
        className="glass"
      >
        <p className="muted">
          Os gráficos aparecerão assim que houver dados suficientes cadastrados na plataforma.
        </p>
      </div>
    </div>
  );
}
