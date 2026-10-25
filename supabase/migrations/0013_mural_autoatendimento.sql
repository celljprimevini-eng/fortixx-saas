-- ============================================================================
-- 0013 — MURAL (engajamento) + AUTOATENDIMENTO
-- ============================================================================
-- Dois módulos novos do dashboard (decisão do Vini, 25/10/2026, a partir do
-- mapeamento de funcionalidades da Joinin — só as funcionalidades, nada de
-- código, texto ou layout de terceiros):
--
--   Mural          — feed da empresa (posts e comunicados oficiais), curtidas,
--                    comentários, enquetes/pesquisas e aniversariantes.
--   Autoatendimento — pedidos de férias/folga com aprovação, central de
--                    solicitações ao RH, eventos com inscrição e assinatura
--                    eletrônica simples de termos.
--
-- Convenções de 0001/0011: uuid pk, tenant_id obrigatório com FK em cascade,
-- índice em tenant_id, status text+check, timestamps com default.
--
-- RLS: só políticas de SELECT. Toda escrita passa pelas rotas de API
-- (src/app/api/mural, src/app/api/autoatendimento), que checam sessão, papel e
-- tenant no servidor e gravam com a service_role. Sem política de escrita, um
-- usuário com o JWT dele não consegue inserir/alterar nada direto pelo
-- PostgREST.
-- ============================================================================

-- Data de nascimento (aniversariantes do Mural). Opcional.
alter table profiles add column if not exists birth_date date;

-- ── MURAL ───────────────────────────────────────────────────────────────────
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post','comunicado','aniversario')),
  body text not null check (char_length(body) between 1 and 4000),
  -- aniversário: de quem é a festa (o autor é quem deu parabéns)
  subject_profile_id uuid references profiles(id) on delete cascade,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_tenant_created on posts(tenant_id, created_at desc);

create table if not exists post_reactions (
  post_id uuid not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
create index if not exists idx_post_reactions_tenant on post_reactions(tenant_id);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_post_comments_post on post_comments(post_id, created_at);
create index if not exists idx_post_comments_tenant on post_comments(tenant_id);

create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  question text not null check (char_length(question) between 3 and 300),
  anonymous boolean not null default false,
  closes_at timestamptz,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_polls_tenant_created on polls(tenant_id, created_at desc);

create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position int not null default 0
);
create index if not exists idx_poll_options_poll on poll_options(poll_id);

create table if not exists poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, profile_id)
);
create index if not exists idx_poll_votes_tenant on poll_votes(tenant_id);

-- ── AUTOATENDIMENTO ─────────────────────────────────────────────────────────
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'ferias' check (kind in ('ferias','folga','licenca')),
  start_date date not null,
  end_date date not null,
  days int not null check (days > 0),
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','canceled')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_leave_requests_tenant on leave_requests(tenant_id, created_at desc);
create index if not exists idx_leave_requests_profile on leave_requests(profile_id);

create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('documento','beneficio','dados_cadastrais','holerite','ponto','outro')),
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'open' check (status in ('open','in_progress','done','rejected')),
  response text,
  handled_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_service_requests_tenant on service_requests(tenant_id, created_at desc);
create index if not exists idx_service_requests_profile on service_requests(profile_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_events_tenant_starts on events(tenant_id, starts_at);

create table if not exists event_registrations (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
create index if not exists idx_event_registrations_tenant on event_registrations(tenant_id);

-- Assinatura eletrônica SIMPLES (Lei 14.063/2020, art. 4º, I): identifica o
-- signatário pela sessão autenticada (login + 2FA) e guarda a evidência —
-- nome digitado, data/hora, IP, navegador e o hash SHA-256 do conteúdo exato
-- que foi assinado. Não é assinatura qualificada (ICP-Brasil).
create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  content text not null check (char_length(content) between 1 and 20000),
  content_hash text not null,
  status text not null default 'pending' check (status in ('pending','signed','declined')),
  requested_by uuid references profiles(id),
  signed_name text,
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_signature_requests_tenant on signature_requests(tenant_id, created_at desc);
create index if not exists idx_signature_requests_profile on signature_requests(profile_id);

-- ── RLS (somente leitura) ───────────────────────────────────────────────────
alter table posts enable row level security;
alter table post_reactions enable row level security;
alter table post_comments enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;
alter table leave_requests enable row level security;
alter table service_requests enable row level security;
alter table events enable row level security;
alter table event_registrations enable row level security;
alter table signature_requests enable row level security;

-- Mural e eventos: todo mundo do tenant lê.
drop policy if exists "posts_select_tenant" on posts;
create policy "posts_select_tenant" on posts for select using (tenant_id = auth_tenant_id());
drop policy if exists "post_reactions_select_tenant" on post_reactions;
create policy "post_reactions_select_tenant" on post_reactions for select using (tenant_id = auth_tenant_id());
drop policy if exists "post_comments_select_tenant" on post_comments;
create policy "post_comments_select_tenant" on post_comments for select using (tenant_id = auth_tenant_id());
drop policy if exists "polls_select_tenant" on polls;
create policy "polls_select_tenant" on polls for select using (tenant_id = auth_tenant_id());
drop policy if exists "poll_options_select_tenant" on poll_options;
create policy "poll_options_select_tenant" on poll_options for select using (tenant_id = auth_tenant_id());
drop policy if exists "events_select_tenant" on events;
create policy "events_select_tenant" on events for select using (tenant_id = auth_tenant_id());
drop policy if exists "event_registrations_select_tenant" on event_registrations;
create policy "event_registrations_select_tenant" on event_registrations for select using (tenant_id = auth_tenant_id());

-- Voto: cada um vê o próprio (contagem agregada vem pela API, que respeita
-- enquete anônima).
drop policy if exists "poll_votes_select_own" on poll_votes;
create policy "poll_votes_select_own" on poll_votes for select
  using (tenant_id = auth_tenant_id() and (profile_id = auth.uid() or auth_role() in ('admin','rh')));

-- Pedidos pessoais: o dono vê os dele; RH/Admin/gestor veem os do tenant.
drop policy if exists "leave_requests_select" on leave_requests;
create policy "leave_requests_select" on leave_requests for select
  using (tenant_id = auth_tenant_id() and (profile_id = auth.uid() or auth_role() in ('admin','rh','gestor')));
drop policy if exists "service_requests_select" on service_requests;
create policy "service_requests_select" on service_requests for select
  using (tenant_id = auth_tenant_id() and (profile_id = auth.uid() or auth_role() in ('admin','rh')));
drop policy if exists "signature_requests_select" on signature_requests;
create policy "signature_requests_select" on signature_requests for select
  using (tenant_id = auth_tenant_id() and (profile_id = auth.uid() or auth_role() in ('admin','rh')));

-- ── NOTIFICAÇÃO PUSH (Web Push / VAPID) ─────────────────────────────────────
-- Uma linha por navegador/aparelho que aceitou receber push. O endpoint é
-- único por inscrição; se o navegador revogar, a API apaga ao receber 404/410.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_profile on push_subscriptions(profile_id);
create index if not exists idx_push_subscriptions_tenant on push_subscriptions(tenant_id);
alter table push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_select_own" on push_subscriptions;
create policy "push_subscriptions_select_own" on push_subscriptions for select
  using (profile_id = auth.uid());
