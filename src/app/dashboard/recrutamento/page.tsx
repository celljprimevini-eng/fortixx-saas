import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recrutamento · Fortixx',
  description: 'Gerencie vagas e candidatos em um pipeline visual.',
};

export default async function RecrutamentoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
      <div className="view-head">
        <div>
          <h1 className="view-title">Recrutamento</h1>
          <p className="view-sub">Gerencie vagas e acompanhe candidatos no pipeline.</p>
        </div>
        <button className="btn btn-primary btn-sm">+ Nova vaga</button>
      </div>

      {/* Colunas Kanban */}
      <div className="kanban" style={{ marginTop: 32 }}>
        {['Triagem', 'Entrevista RH', 'Entrevista Gestor', 'Proposta'].map((col) => (
          <div key={col}>
            <div className="kanban-col-title">{col}</div>
            <div
              style={{
                minHeight: 200,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <p className="muted" style={{ fontSize: '.8rem', textAlign: 'center', paddingTop: 32 }}>
                Nenhum candidato
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
