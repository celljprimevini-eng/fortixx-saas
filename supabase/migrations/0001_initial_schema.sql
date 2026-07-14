-- ============================================================================
-- FORTIXX RH — SCHEMA COMPLETO MULTI-TENANT (tabelas e índices)
-- ============================================================================
-- Row Level Security fica em 0002_row_level_security.sql — separado de
-- propósito, para deixar claro quando o isolamento entre empresas é ligado.
-- Toda tabela de negócio carrega tenant_id.

create extension if not exists "pgcrypto";

-- ============================================================================
-- TENANTS (empresas clientes da Fortixx)
-- ============================================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  plan text not null default 'basico' check (plan in ('basico','pro','enterprise')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text default 'trialing' check (subscription_status in ('trialing','active','past_due','canceled','incomplete','paused','incomplete_expired','unpaid')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- PROFILES (usuários — estende auth.users do Supabase)
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  role text not null default 'colaborador' check (role in ('admin','rh','gestor','colaborador')),
  department_id uuid,
  job_title text,
  manager_id uuid references profiles(id),
  phone text,
  status text not null default 'active' check (status in ('active','inactive','on_leave')),
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_tenant on profiles(tenant_id);
create index idx_profiles_manager on profiles(manager_id);

-- ============================================================================
-- DEPARTAMENTOS
-- ============================================================================
create table departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  parent_id uuid references departments(id),
  head_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_departments_tenant on departments(tenant_id);

alter table profiles add constraint fk_profiles_department
  foreign key (department_id) references departments(id) on delete set null;

-- ============================================================================
-- RECRUTAMENTO: VAGAS
-- ============================================================================
create table job_openings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  department_id uuid references departments(id),
  description text,
  requirements text,
  location text,
  employment_type text default 'clt' check (employment_type in ('clt','pj','estagio','temporario')),
  status text not null default 'open' check (status in ('open','paused','closed')),
  is_public boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_jobs_tenant on job_openings(tenant_id);
create index idx_jobs_public on job_openings(is_public, status) where is_public = true;

-- ============================================================================
-- RECRUTAMENTO: CANDIDATOS / PIPELINE
-- ============================================================================
create table candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_opening_id uuid references job_openings(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  resume_url text,
  resume_raw_text text,
  extracted_skills text[],
  stage text not null default 'recebido' check (stage in ('recebido','triagem','analise','entrevista','aprovado','reprovado')),
  source text default 'portal_publico',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_candidates_tenant on candidates(tenant_id);
create index idx_candidates_job on candidates(job_opening_id);
create index idx_candidates_stage on candidates(tenant_id, stage);

-- ============================================================================
-- ONBOARDING
-- ============================================================================
create table onboardings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  candidate_id uuid references candidates(id),
  status text not null default 'em_andamento' check (status in ('em_andamento','concluido','atrasado')),
  start_date date not null default current_date,
  target_completion_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_onboardings_tenant on onboardings(tenant_id);

create table onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboardings(id) on delete cascade,
  title text not null,
  description text,
  done boolean not null default false,
  done_at timestamptz,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_onb_tasks_onboarding on onboarding_tasks(onboarding_id);

-- ============================================================================
-- DOCUMENTOS
-- ============================================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size_bytes bigint,
  category text check (category in ('identidade','comprovante','contrato','curriculo','outro')),
  ocr_status text default 'pendente' check (ocr_status in ('pendente','processando','concluido','falhou','baixa_confianca')),
  ocr_confidence numeric(4,1),
  ocr_extracted jsonb,
  approval_status text default 'pending' check (approval_status in ('pending','approved','rejected')),
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_documents_tenant on documents(tenant_id);
create index idx_documents_profile on documents(profile_id);

-- ============================================================================
-- ESCALAS
-- ============================================================================
create table schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  shift_date date not null,
  shift_type text not null check (shift_type in ('manha','tarde','noite','folga')),
  start_time time,
  end_time time,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','absent')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique(profile_id, shift_date)
);
create index idx_schedules_tenant on schedules(tenant_id);
create index idx_schedules_profile_date on schedules(profile_id, shift_date);

create table schedule_read_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  schedule_period text not null,
  confirmed_at timestamptz,
  notified_at timestamptz default now(),
  notified_via text[] default array['app']::text[]
);
create index idx_schedule_confirm_tenant on schedule_read_confirmations(tenant_id);

create table schedule_change_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  schedule_id uuid references schedules(id) on delete set null,
  changed_by uuid references profiles(id),
  change_description text not null,
  created_at timestamptz not null default now()
);
create index idx_schedule_log_tenant on schedule_change_log(tenant_id);

-- ============================================================================
-- NOTIFICAÇÕES
-- ============================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('documentos','escalas','onboarding','sistema')),
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_profile on notifications(profile_id, read);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_tenant on audit_logs(tenant_id);

-- ============================================================================
-- updated_at automático
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_tenants_updated before update on tenants for each row execute function set_updated_at();
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_jobs_updated before update on job_openings for each row execute function set_updated_at();
create trigger trg_candidates_updated before update on candidates for each row execute function set_updated_at();
