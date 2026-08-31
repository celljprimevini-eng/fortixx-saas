-- ============================================================================
-- ONBOARDING > TREINAMENTOS
-- ============================================================================
-- Hoje a subview "onb-treinamentos" é 3 cards de progresso fixos no
-- protótipo. `trainings` é o catálogo (um treinamento pode ser feito por
-- vários colaboradores) e `training_progress` guarda o progresso individual
-- de cada colaborador em cada treinamento — 1 linha por (training, profile),
-- reforçado pelo unique. Mesma convenção de 0001_initial_schema.sql.

create table trainings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);
create index idx_trainings_tenant on trainings(tenant_id);

create table training_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  training_id uuid not null references trainings(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(training_id, profile_id)
);
create index idx_training_progress_tenant on training_progress(tenant_id);
create index idx_training_progress_training on training_progress(training_id);
create index idx_training_progress_profile on training_progress(profile_id);

-- updated_at automático (reusa a função set_updated_at criada em
-- 0001_initial_schema.sql)
create trigger trg_training_progress_updated before update on training_progress
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS — mesmo padrão de 0002_row_level_security.sql.
-- trainings: catálogo do tenant, RH/Admin gerenciam, todos leem.
-- training_progress: o próprio colaborador vê/atualiza o próprio progresso;
-- RH/Admin/gestor veem tudo do tenant (igual onboardings_select); só
-- RH/Admin gerenciam qualquer linha (ex: zerar progresso de outra pessoa).
-- ============================================================================
alter table trainings enable row level security;
alter table training_progress enable row level security;

create policy "trainings_select_tenant" on trainings for select
  using (tenant_id = auth_tenant_id());
create policy "trainings_write_admin_rh" on trainings for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

create policy "training_progress_select" on training_progress for select
  using (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh','gestor'))
  );
create policy "training_progress_upsert_own" on training_progress for insert
  with check (tenant_id = auth_tenant_id() and profile_id = auth.uid());
create policy "training_progress_update_own_or_admin_rh" on training_progress for update
  using (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh'))
  );
create policy "training_progress_delete_admin_rh" on training_progress for delete
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));
