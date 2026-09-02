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

-- Base de conhecimento do Assistente RH (modo FAQ). Sem isso, o assistente
-- responde tudo com "vou encaminhar pro RH" — com isso, ele resolve na hora.
insert into public.hr_faqs (tenant_id, question, answer, views) values
  ('00000000-0000-0000-0000-000000000001', 'Como solicito minhas férias?', 'No Portal do Colaborador, em Solicitações > Nova solicitação > Férias. O pedido vai automaticamente pro seu gestor aprovar. Peça com pelo menos 30 dias de antecedência.', 142),
  ('00000000-0000-0000-0000-000000000001', 'Onde vejo meu holerite / contracheque?', 'Em Documentos, dentro do Portal do Colaborador. O holerite do mês fica disponível todo dia 5.', 98),
  ('00000000-0000-0000-0000-000000000001', 'Como corrijo um erro no meu ponto?', 'Abra uma solicitação de ajuste de ponto informando a data e o horário correto. Seu gestor recebe a aprovação automaticamente.', 71),
  ('00000000-0000-0000-0000-000000000001', 'Quais benefícios eu tenho?', 'Os benefícios ativos são: plano de saúde, vale-refeição, vale-alimentação e vale-transporte. Os detalhes de cada um estão em Documentos > Benefícios.', 64),
  ('00000000-0000-0000-0000-000000000001', 'Quantos dias de férias eu tenho acumulados?', 'O saldo exato aparece no Portal do Colaborador, na tela inicial. Cada 12 meses trabalhados dá direito a 30 dias.', 55),
  ('00000000-0000-0000-0000-000000000001', 'Como funciona o home office / trabalho remoto?', 'A política de trabalho remoto está em Documentos > Políticas. Combine o formato (presencial, híbrido ou remoto) com seu gestor.', 47),
  ('00000000-0000-0000-0000-000000000001', 'Como peço um atestado ou justifico uma falta?', 'Envie o atestado pelo Portal do Colaborador em até 48h, em Solicitações > Atestado. Faltas sem justificativa podem ser descontadas.', 39),
  ('00000000-0000-0000-0000-000000000001', 'Qual o horário de trabalho e a tolerância de entrada?', 'O horário padrão é de segunda a sexta, das 9h às 18h, com 1h de almoço. A tolerância é de 10 minutos na entrada.', 33);
