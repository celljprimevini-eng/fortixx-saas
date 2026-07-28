import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Colaboradores · Fortixx',
  description: 'Gerencie todos os colaboradores da sua empresa.',
};

export default async function ColaboradoresPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
      <div className="view-head">
        <div>
          <h1 className="view-title">Colaboradores</h1>
          <p className="view-sub">Gerencie o cadastro e perfil de todos os colaboradores.</p>
        </div>
        <button className="btn btn-primary btn-sm">+ Adicionar colaborador</button>
      </div>

      {/* Busca */}
      <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
        <input
          className="form-input"
          type="search"
          placeholder="Buscar por nome, cargo ou departamento…"
          style={{ flex: 1, maxWidth: 400 }}
        />
        <select className="form-input" style={{ width: 180 }}>
          <option>Todos os departamentos</option>
        </select>
      </div>

      {/* Lista vazia */}
      <div
        style={{
          marginTop: 24,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 48,
          textAlign: 'center',
        }}
        className="glass"
      >
        <p className="muted">Nenhum colaborador cadastrado ainda.</p>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
          Cadastrar primeiro colaborador
        </button>
      </div>
    </div>
  );
}
