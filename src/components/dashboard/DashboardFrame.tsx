'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface DashboardFrameProps {
  name: string;
  tenantName?: string;
  plan?: string;
  kpiColaboradores: number;
  kpiVagas: number;
  kpiOnboardings: number;
  kpiSolicitacoes: number;
}

/**
 * A "Plataforma de RH" completa (protótipo validado pela Renata) roda isolada
 * dentro de um iframe apontando pra /dashboard/platform — é HTML/CSS/JS vanilla
 * auto-suficiente, então isolar evita colisão de CSS/JS com o resto do app
 * (que usa React). Os 4 KPIs do topo e o nome/empresa no topbar são os únicos
 * pontos já ligados a dado real do Supabase nesta fase; o resto dos módulos
 * (Colaboradores, Recrutamento, Onboarding, Assistente RH, Analytics,
 * Configurações) ainda mostra o conteúdo de demonstração do protótipo.
 */
export default function DashboardFrame({
  name,
  tenantName,
  plan,
  kpiColaboradores,
  kpiVagas,
  kpiOnboardings,
  kpiSolicitacoes,
}: DashboardFrameProps) {
  const router = useRouter();
  const supabase = createClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'fortixx:sign-out') {
        await supabase.auth.signOut();
        router.push('/auth/login');
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router, supabase]);

  const params = new URLSearchParams();
  params.set('name', name);
  if (tenantName) params.set('tenant', tenantName);
  if (plan) params.set('plan', plan);
  params.set('kpiColaboradores', String(kpiColaboradores));
  params.set('kpiVagas', String(kpiVagas));
  params.set('kpiOnboardings', String(kpiOnboardings));
  params.set('kpiSolicitacoes', String(kpiSolicitacoes));

  return (
    <iframe
      ref={iframeRef}
      src={`/dashboard/platform?${params.toString()}`}
      title="Plataforma de RH"
      style={{
        display: 'block',
        width: '100%',
        height: '100dvh',
        border: 'none',
      }}
    />
  );
}
