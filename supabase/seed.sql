-- ============================================================================
-- SEED — dados de demonstração para desenvolvimento local
-- Rodar com: supabase db reset (aplica migrations + este seed)
-- NÃO rodar em produção.
-- ============================================================================

insert into public.tenants (id, name, slug, plan, subscription_status) values
  ('00000000-0000-0000-0000-000000000001', 'Fortixx Demo LTDA', 'fortixx-demo', 'pro', 'active');

-- Os usuários de auth.users precisam ser criados via Supabase Auth Admin API
-- (scripts/setup.js faz isso automaticamente). Este seed assume que os UUIDs
-- abaixo já existem em auth.users antes de rodar.

-- Departamentos
insert into public.departments (id, tenant_id, name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Recursos Humanos'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Comercial'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Tecnologia'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Operações');

-- Vaga pública de exemplo
insert into public.job_openings (tenant_id, title, department_id, description, location, is_public, status) values
  ('00000000-0000-0000-0000-000000000001', 'Analista de Marketing', '10000000-0000-0000-0000-000000000002', 'Vaga para atuar com campanhas digitais e growth.', 'Remoto', true, 'open'),
  ('00000000-0000-0000-0000-000000000001', 'Dev Backend Pleno', '10000000-0000-0000-0000-000000000003', 'Node.js, PostgreSQL, experiência com APIs REST.', 'São Paulo, SP', true, 'open');
