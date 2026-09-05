-- ============================================================================
-- 0012 — Cobrança via Cakto (cartão de crédito recorrente)
-- ============================================================================
-- A Cakto passa a ser um provedor de cobrança alternativo ao Stripe. O
-- webhook da Cakto (/api/cakto/webhook) é a fonte de verdade do status da
-- assinatura, do mesmo jeito que o do Stripe. Guardamos os IDs da Cakto em
-- colunas próprias pra não misturar com os campos stripe_*.

alter table tenants add column if not exists cakto_customer_id text;
alter table tenants add column if not exists cakto_subscription_id text;
alter table tenants add column if not exists billing_provider text
  not null default 'stripe' check (billing_provider in ('stripe', 'cakto'));

comment on column tenants.cakto_subscription_id is
  'ID da assinatura na Cakto (data.subscription.id do webhook). Fonte de verdade = webhook.';
comment on column tenants.billing_provider is
  'Qual provedor de cobrança está ativo pra esse tenant.';

create index if not exists idx_tenants_cakto_subscription
  on tenants (cakto_subscription_id)
  where cakto_subscription_id is not null;
