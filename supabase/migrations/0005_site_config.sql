-- ============================================================================
-- SITE_CONFIG — configurações editáveis da landing (multi-tenant, white-label)
-- ============================================================================
-- Cada tenant (empresa) tem 1 linha em site_config com todo o conteúdo
-- editável da landing: nome, logo, cores, headlines, preços, planos, FAQ.
--
-- Leitura: pública, filtrada por slug ou tenant_id (a landing é pública
--          para qualquer visitante — o site é marketing, não dados sensíveis).
-- Escrita: apenas admin do tenant pode editar (via /admin).
--
-- Como cada tenant customiza sua própria landing:
--   1. Admin entra em /admin e edita o form
--   2. Salva → row atualizada em site_config
--   3. Próxima renderização da landing usa o config (com fallback Fortixx
--      se ainda não editou)
-- ============================================================================

create table site_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  slug text unique not null, -- ex: 'fortixx', 'vetta', 'nortis' — usado em URLs
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create index idx_site_config_slug on site_config(slug);
create index idx_site_config_tenant on site_config(tenant_id);

-- Trigger pra manter updated_at sempre fresh
create or replace function touch_site_config()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_touch_site_config
  before update on site_config
  for each row execute function touch_site_config();

-- ============================================================================
-- RLS
-- ============================================================================
alter table site_config enable row level security;

-- Leitura pública (qualquer visitante pode ver a landing de qualquer tenant)
create policy "site_config_public_select" on site_config for select
  using (true);

-- Inserção: apenas admin do tenant (no insert, o tenant_id precisa bater
-- com o tenant do admin autenticado)
create policy "site_config_admin_insert" on site_config for insert
  with check (tenant_id = auth_tenant_id() and auth_role() = 'admin');

-- Update: apenas admin do próprio tenant
create policy "site_config_admin_update" on site_config for update
  using (tenant_id = auth_tenant_id() and auth_role() = 'admin')
  with check (tenant_id = auth_tenant_id() and auth_role() = 'admin');

-- Delete: apenas admin
create policy "site_config_admin_delete" on site_config for delete
  using (tenant_id = auth_tenant_id() and auth_role() = 'admin');

-- ============================================================================
-- SEED: criar config padrão pro tenant Fortixx (id fixo por enquanto)
-- ============================================================================
-- Se a tabela tenants já tem o tenant da Fortixx, cria uma linha
-- site_config com config default (vazio = usa fallback hard-coded).
-- Idempotente: ON CONFLICT não faz nada se já existe.
insert into site_config (tenant_id, slug, config)
select id, slug, '{}'::jsonb
from tenants
where slug = 'fortixx'
on conflict (tenant_id) do nothing;
