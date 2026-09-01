-- ============================================================================
-- ASSISTENTE RH
-- ============================================================================
-- Hoje a view "view-assistente" (4 subtabs: Atendimento, FAQ inteligente,
-- Histórico, Escalonamento) é 100% estática no protótipo. Estas tabelas dão
-- lastro real:
--   hr_faqs          — base de conhecimento que o assistente consulta e a
--                      subtab "FAQ inteligente" renderiza. RH/Admin gerenciam.
--   hr_conversations — uma thread de atendimento por colaborador. `status`
--                      controla Histórico (resolved) e Escalonamento (escalated).
--   hr_messages      — cada mensagem da thread (colaborador ou assistente).
-- Mesma convenção de 0001_initial_schema.sql: uuid pk, tenant_id obrigatório
-- com FK em cascade, índice em tenant_id, status text+check, timestamps default.

create table hr_faqs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  question text not null,
  answer text not null,
  views int not null default 0 check (views >= 0),
  created_at timestamptz not null default now()
);
create index idx_hr_faqs_tenant on hr_faqs(tenant_id);

create table hr_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open','resolved','escalated')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_hr_conversations_tenant on hr_conversations(tenant_id);
create index idx_hr_conversations_profile on hr_conversations(profile_id);

create table hr_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references hr_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_hr_messages_conversation on hr_messages(conversation_id);
create index idx_hr_messages_tenant on hr_messages(tenant_id);

-- ============================================================================
-- RLS — mesmo padrão de 0002_row_level_security.sql / 0010_trainings.sql.
-- hr_faqs: base de conhecimento do tenant, RH/Admin gerenciam, todos leem.
-- hr_conversations / hr_messages: o próprio colaborador vê a própria thread;
-- RH/Admin/gestor veem tudo do tenant (igual training_progress_select).
-- Inserção de mensagem: colaborador só na própria thread; RH/Admin em qualquer
-- thread do tenant (pra poder responder manualmente num escalonamento).
-- ============================================================================
alter table hr_faqs enable row level security;
alter table hr_conversations enable row level security;
alter table hr_messages enable row level security;

create policy "hr_faqs_select_tenant" on hr_faqs for select
  using (tenant_id = auth_tenant_id());
create policy "hr_faqs_write_admin_rh" on hr_faqs for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('admin','rh'));

create policy "hr_conversations_select" on hr_conversations for select
  using (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh','gestor'))
  );
create policy "hr_conversations_insert_own" on hr_conversations for insert
  with check (tenant_id = auth_tenant_id() and profile_id = auth.uid());
create policy "hr_conversations_update_own_or_admin_rh" on hr_conversations for update
  using (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh'))
  );

create policy "hr_messages_select" on hr_messages for select
  using (
    tenant_id = auth_tenant_id()
    and exists (
      select 1 from hr_conversations c
      where c.id = hr_messages.conversation_id
        and (c.profile_id = auth.uid() or auth_role() in ('admin','rh','gestor'))
    )
  );
create policy "hr_messages_insert" on hr_messages for insert
  with check (
    tenant_id = auth_tenant_id()
    and exists (
      select 1 from hr_conversations c
      where c.id = hr_messages.conversation_id
        and (c.profile_id = auth.uid() or auth_role() in ('admin','rh'))
    )
  );
