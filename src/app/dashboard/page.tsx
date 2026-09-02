import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardFrame from '@/components/dashboard/DashboardFrame';

/**
 * Dashboard real: autentica, busca os KPIs no Supabase (isolados por tenant via
 * RLS — não é mock) e entrega pro DashboardFrame, que renderiza a Plataforma de
 * RH completa (protótipo validado pela Renata) num iframe já com esses números.
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
    // Total de colaboradores = todos os profiles do tenant (bate com o donut
    // "Colaboradores por área" no route.ts, que também conta todos).
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('job_openings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'open'),
    supabase.from('onboardings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'em_andamento'),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('approval_status', 'pending'),
  ]);

  const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;

  return (
    <DashboardFrame
      name={profile.full_name}
      tenantName={tenant?.name}
      plan={tenant?.plan}
      kpiColaboradores={totalColaboradores ?? 0}
      kpiVagas={vagasAbertas ?? 0}
      kpiOnboardings={onboardingsAtivos ?? 0}
      kpiSolicitacoes={solicitacoesPendentes ?? 0}
    />
  );
}
