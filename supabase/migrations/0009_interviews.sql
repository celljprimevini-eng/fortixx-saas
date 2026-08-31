-- ============================================================================
-- RECRUTAMENTO > ENTREVISTAS
-- ============================================================================
-- Hoje a subview "recrut-entrevistas" é uma tabela 100% estática no
-- protótipo. Esta tabela guarda entrevistas agendadas de verdade, ligadas a
-- um candidato (obrigatório), opcionalmente a uma vaga, e a um entrevistador
-- (profile do tenant). Segue a mesma convenção de 0001_initial_schema.sql:
-- uuid pk, tenant_id obrigatório com FK em cascade, índice em tenant_id,
-- status como text+check, created_at default now().

create table interviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_opening_id uuid references job_openings(id) on delete set null,
  interviewer_id uuid references profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'agendada' check (status in ('agendada','realizada','cancelada','reagendada')),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_interviews_tenant on interviews(tenant_id);
create index idx_interviews_candidate on interviews(candidate_id);

-- ============================================================================
-- RLS — mesmo padrão de 0002_row_level_security.sql: RH/Admin gerenciam,
-- select por tenant (gestor/colaborador também podem ver a agenda de
-- entrevistas do próprio tenant, igual candidates_select_tenant).
-- ============================================================================
alter table interviews enable row level security;

create policy "interviews_select_tenant" on interviews for select
  using (tenant_id = auth_tenant_id());
create policy "interviews_write_admin_rh" on interviews for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));
