-- ============================================================================
-- ROW LEVEL SECURITY — isto é o que torna "multiempresa" real, não visual.
-- ============================================================================
-- Princípio: toda tabela de negócio só permite SELECT/INSERT/UPDATE/DELETE
-- de linhas cujo tenant_id bate com o tenant_id do usuário autenticado.
-- Isso é aplicado pelo PRÓPRIO POSTGRES, não pelo código da API — então
-- mesmo uma query mal escrita na aplicação não consegue vazar dados de
-- outro tenant.
-- ============================================================================

-- Função auxiliar: retorna o tenant_id do usuário autenticado atual
create or replace function auth_tenant_id()
returns uuid as $$
  select tenant_id from profiles where id = auth.uid()
$$ language sql stable security definer;

-- Função auxiliar: retorna o role do usuário autenticado atual
create or replace function auth_role()
returns text as $$
  select role from profiles where id = auth.uid()
$$ language sql stable security definer;

-- ============================================================================
-- Habilitar RLS em todas as tabelas de negócio
-- ============================================================================
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table departments enable row level security;
alter table job_openings enable row level security;
alter table candidates enable row level security;
alter table onboardings enable row level security;
alter table onboarding_tasks enable row level security;
alter table documents enable row level security;
alter table schedules enable row level security;
alter table schedule_change_log enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ============================================================================
-- TENANTS: usuário só vê a própria empresa
-- ============================================================================
create policy "tenant_select_own" on tenants for select
  using (id = auth_tenant_id());
create policy "tenant_update_admin" on tenants for update
  using (id = auth_tenant_id() and auth_role() = 'admin');

-- ============================================================================
-- PROFILES: isolamento por tenant + regra por papel
-- ============================================================================
create policy "profiles_select_tenant" on profiles for select
  using (tenant_id = auth_tenant_id());

create policy "profiles_insert_admin_rh" on profiles for insert
  with check (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

create policy "profiles_update_own_or_admin_rh" on profiles for update
  using (
    tenant_id = auth_tenant_id()
    and (id = auth.uid() or auth_role() in ('admin','rh'))
  );

create policy "profiles_delete_admin" on profiles for delete
  using (tenant_id = auth_tenant_id() and auth_role() = 'admin');

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================
create policy "departments_select_tenant" on departments for select
  using (tenant_id = auth_tenant_id());
create policy "departments_write_admin_rh" on departments for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

-- ============================================================================
-- JOB OPENINGS: RH e Admin gerenciam; Gestor/Colaborador só leem
-- ============================================================================
create policy "jobs_select_tenant" on job_openings for select
  using (tenant_id = auth_tenant_id());
create policy "jobs_write_admin_rh" on job_openings for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

-- ============================================================================
-- CANDIDATES
-- ============================================================================
create policy "candidates_select_tenant" on candidates for select
  using (tenant_id = auth_tenant_id());
create policy "candidates_write_admin_rh" on candidates for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

-- Portal público de candidaturas usa a service_role key (bypassa RLS) —
-- nunca a chave anon. Ver src/app/api/recrutamento/apply/route.ts

-- ============================================================================
-- ONBOARDINGS: RH/Admin gerenciam; o próprio colaborador vê o seu
-- ============================================================================
create policy "onboardings_select" on onboardings for select
  using (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh','gestor'))
  );
create policy "onboardings_write_admin_rh" on onboardings for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

create policy "onboarding_tasks_select" on onboarding_tasks for select
  using (
    onboarding_id in (
      select id from onboardings
      where tenant_id = auth_tenant_id()
      and (profile_id = auth.uid() or auth_role() in ('admin','rh','gestor'))
    )
  );
create policy "onboarding_tasks_write" on onboarding_tasks for all
  using (
    onboarding_id in (select id from onboardings where tenant_id = auth_tenant_id())
    and auth_role() in ('admin','rh')
  );

-- ============================================================================
-- DOCUMENTS: dono do documento ou RH/Admin
-- ============================================================================
create policy "documents_select" on documents for select
  using (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh'))
  );
create policy "documents_insert_own" on documents for insert
  with check (tenant_id = auth_tenant_id());
create policy "documents_write_admin_rh" on documents for update
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

-- ============================================================================
-- SCHEDULES: colaborador vê a própria; gestor vê a equipe; RH/Admin vê tudo
-- ============================================================================
create policy "schedules_select" on schedules for select
  using (
    tenant_id = auth_tenant_id()
    and (
      profile_id = auth.uid()
      or auth_role() in ('admin','rh')
      or (auth_role() = 'gestor' and profile_id in (select id from profiles where manager_id = auth.uid()))
    )
  );
create policy "schedules_write_admin_rh_gestor" on schedules for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh','gestor'));

create policy "schedule_log_select" on schedule_change_log for select
  using (tenant_id = auth_tenant_id());

-- ============================================================================
-- NOTIFICATIONS: cada usuário só vê as próprias
-- ============================================================================
create policy "notifications_select_own" on notifications for select
  using (tenant_id = auth_tenant_id() and profile_id = auth.uid());
create policy "notifications_update_own" on notifications for update
  using (tenant_id = auth_tenant_id() and profile_id = auth.uid());
create policy "notifications_insert_system" on notifications for insert
  with check (tenant_id = auth_tenant_id());

-- ============================================================================
-- AUDIT LOGS: só Admin lê; ninguém edita ou apaga
-- ============================================================================
create policy "audit_select_admin" on audit_logs for select
  using (tenant_id = auth_tenant_id() and auth_role() = 'admin');
create policy "audit_insert_system" on audit_logs for insert
  with check (tenant_id = auth_tenant_id());
