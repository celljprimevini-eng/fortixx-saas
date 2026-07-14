import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SignOutButton from '@/components/dashboard/sign-out-button';

/**
 * Este é o primeiro Dashboard REAL: os números abaixo vêm do banco,
 * filtrados automaticamente pelo tenant do usuário logado via RLS
 * (veja supabase/migrations/0002_row_level_security.sql). Não é mock.
 *
 * O visual completo (KPIs com sparkline, gráfico de crescimento com
 * glow, dock de navegação, Ctrl+K etc.) do fortixx-plataforma.html
 * ainda precisa ser portado para componentes React — este arquivo é
 * a base funcional sobre a qual esse visual entra, não o substituto
 * dele. Ver README.md → "O que ainda falta" para o estado exato.
 */
export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tenant_id, tenants(name, plan, subscription_status, trial_ends_at)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // Usuário autenticado mas sem profile — não deveria acontecer se o
    // trigger de signup (0003) rodou corretamente. Falha segura: desloga.
    await supabase.auth.signOut();
    redirect('/auth/login');
  }

  const tenantId = profile.tenant_id;

  const [
    { count: totalColaboradores },
    { count: vagasAbertas },
    { count: onboardingsAtivos },
    { count: solicitacoesPendentes },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('job_openings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'open'),
    supabase.from('onboardings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'em_andamento'),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('approval_status', 'pending'),
  ]);

  const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;

  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
      <div className="view-head">
        <div>
          <h1 className="view-title">Olá, {profile.full_name.split(' ')[0]} 👋</h1>
          <p className="view-sub">
            {tenant?.name} · plano {tenant?.plan} ·{' '}
            {tenant?.subscription_status === 'trialing' ? 'período de teste' : tenant?.subscription_status}
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="kpi-grid" style={{ marginTop: 28 }}>
        <div className="kpi-card glass accent-blue">
          <div className="kpi-top"><span className="kpi-label">Total de colaboradores</span></div>
          <div className="kpi-value">{totalColaboradores ?? 0}</div>
        </div>
        <div className="kpi-card glass accent-gold">
          <div className="kpi-top"><span className="kpi-label">Vagas abertas</span></div>
          <div className="kpi-value">{vagasAbertas ?? 0}</div>
        </div>
        <div className="kpi-card glass accent-blue">
          <div className="kpi-top"><span className="kpi-label">Onboardings ativos</span></div>
          <div className="kpi-value">{onboardingsAtivos ?? 0}</div>
        </div>
        <div className="kpi-card glass accent-warn">
          <div className="kpi-top"><span className="kpi-label">Documentos pendentes</span></div>
          <div className="kpi-value">{solicitacoesPendentes ?? 0}</div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 32, fontSize: '.85rem' }}>
        Estes números são consultados em tempo real do Supabase, isolados por empresa via Row Level Security —
        não é dado de demonstração. O visual completo do dashboard (gráficos, Dock, Ctrl+K) ainda precisa ser
        portado para React; ver README.md.
      </p>
    </div>
  );
}
