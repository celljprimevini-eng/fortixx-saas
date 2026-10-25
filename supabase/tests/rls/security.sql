-- Teste de segurança das policies/triggers (rodar com run.sh).
-- Cenário: empresa A (admin a1, rh r1, colaborador c1) e empresa B (admin b1).
-- Cada caso roda numa transação desfeita no fim (begin ... rollback).
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function t_exec(claims text, stmt text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role ' || coalesce(nullif(claims, '')::jsonb->>'role', 'anon');
  begin
    execute stmt;
    get diagnostics n = row_count;
    reset role;
    return 'OK rows=' || n;
  exception when others then
    reset role;
    return 'ERR ' || sqlerrm;
  end;
end $$;

create or replace function t_count(claims text, stmt text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role ' || coalesce(nullif(claims, '')::jsonb->>'role', 'anon');
  begin
    execute 'select count(*) from (' || stmt || ') s' into n;
    reset role;
    return 'rows=' || n;
  exception when others then
    reset role;
    return 'ERR ' || sqlerrm;
  end;
end $$;

-- Signup simulado (o GoTrue insere em auth.users; o trigger cria tenant+profile).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@a.com', '{"company_name":"Empresa A","full_name":"Admin A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@b.com', '{"company_name":"Empresa B","full_name":"Admin B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@a.com', '{"full_name":"Colab"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'r1@a.com', '{"full_name":"RH"}');
-- c1 e r1 viram membros da empresa A (como o approve/provision fazem).
update profiles set tenant_id = (select tenant_id from profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  role = 'colaborador' where id = '00000000-0000-0000-0000-0000000000c1';
update profiles set tenant_id = (select tenant_id from profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  role = 'rh' where id = '00000000-0000-0000-0000-0000000000d1';

delete from tenants t where not exists (select 1 from profiles p where p.tenant_id = t.id);

insert into storage.buckets values ('documents', 'documents', false) on conflict do nothing;
insert into storage.objects (bucket_id, name)
select 'documents', t || '/' || p from (select tenant_id::text t from profiles where id = '00000000-0000-0000-0000-0000000000a1') x,
  unnest(array['00000000-0000-0000-0000-0000000000c1/rg-colab.jpg',
               '00000000-0000-0000-0000-0000000000a1/rg-admin.jpg',
               'candidates/cv.pdf']) p;

\set c1 '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal2"}'
\set c1_aal1 '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal1"}'
\set r1 '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal2"}'
\set a1 '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}'
\set b1 '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal2"}'
\set svc '{"role":"service_role"}'
\set A '(select tenant_id from profiles where id = ''00000000-0000-0000-0000-0000000000a1'')'

\echo '--- ATAQUES (esperado depois do fix: ERR ou rows=0)'
begin; select '1  colaborador se promove a admin      : ' || t_exec(:'c1', $$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;
begin; select '1b rh se promove a admin               : ' || t_exec(:'r1', $$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d1'$$); rollback;
begin; select '1c rh promove colaborador a admin      : ' || t_exec(:'r1', $$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;
begin; select '1d colaborador troca o próprio tenant  : ' || t_exec(:'c1', $$update profiles set tenant_id = (select tenant_id from profiles where id='00000000-0000-0000-0000-0000000000b1') where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;
begin; select '2  admin libera plano sem pagar        : ' || t_exec(:'a1', $$update tenants set plan = 'enterprise', subscription_status = 'active'$$); rollback;
begin; insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e1', 'e@e.com', '{"company_name":"Esperto","plan":"enterprise","subscription_status":"active"}');
       select '3  signup com plan no metadata         : plan=' || plan || ' status=' || subscription_status from tenants where name = 'Esperto'; rollback;
begin; delete from profiles where id = '00000000-0000-0000-0000-0000000000c1';
       select '4  ex-funcionário recria perfil admin  : ' || t_exec(:'c1', format($$insert into profiles (id, tenant_id, full_name, email, role) values ('00000000-0000-0000-0000-0000000000c1', %L, 'x', 'x', 'admin')$$, (select tenant_id from profiles where id = '00000000-0000-0000-0000-0000000000a1'))); rollback;
begin; select '5  anônimo cria empresa                : ' || t_exec('{"role":"anon"}', $$insert into tenants (name, slug) values ('spam', 'spam')$$); rollback;
begin; select '6  colaborador lista docs de outros    : ' || t_count(:'c1', $$select name from storage.objects where bucket_id = 'documents' and name not like '%0000000000c1/%'$$); rollback;
begin; select '7  sessão sem 2FA (aal1) lê perfis     : ' || t_count(:'c1_aal1', $$select * from profiles$$); rollback;
begin; select '8  empresa B lê perfis da empresa A    : ' || t_count(:'b1', $$select * from profiles where tenant_id <> (select tenant_id from profiles where id='00000000-0000-0000-0000-0000000000b1')$$); rollback;
begin; select '9  colaborador muda o próprio cargo    : ' || t_exec(:'c1', $$update profiles set job_title = 'Diretor', status = 'active', manager_id = null where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;

\echo '--- USO LEGÍTIMO (esperado: OK rows=1 / rows>0)'
begin; select 'L1 admin promove colaborador a rh      : ' || t_exec(:'a1', $$update profiles set role = 'rh' where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;
begin; select 'L2 rh edita cargo do colaborador       : ' || t_exec(:'r1', $$update profiles set job_title = 'Analista' where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;
begin; select 'L3 colaborador edita o próprio telefone: ' || t_exec(:'c1', $$update profiles set phone = '11999', full_name = 'Colab Novo' where id = '00000000-0000-0000-0000-0000000000c1'$$); rollback;
begin; select 'L4 colaborador vê o próprio documento  : ' || t_count(:'c1', $$select name from storage.objects where bucket_id = 'documents'$$); rollback;
begin; select 'L5 rh vê todos os docs da empresa      : ' || t_count(:'r1', $$select name from storage.objects where bucket_id = 'documents'$$); rollback;
begin; select 'L6 service_role atualiza plano         : ' || t_exec(:'svc', $$update tenants set plan = 'pro', subscription_status = 'active'$$); rollback;
begin; select 'L7 admin renomeia a empresa            : ' || t_exec(:'a1', $$update tenants set name = 'Empresa A S/A'$$); rollback;
begin; select 'L8 colaborador aal2 lê perfis          : ' || t_count(:'c1', $$select * from profiles$$); rollback;
begin; insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000f1', 'f@f.com', '{"company_name":"Nova Ltda"}', '{"plan":"pro","subscription_status":"active"}');
       select 'L9 signup normal cria tenant+admin     : ' || t.name || ' plan=' || t.plan || ' ' || t.subscription_status || ' role=' || p.role from profiles p join tenants t on t.id = p.tenant_id where p.id = '00000000-0000-0000-0000-0000000000f1'; rollback;
begin; set local role service_role;
\o /dev/null
       select user_id from provision_user_tenant('novo@cliente.com', 'SenhaForte123', 'Cliente Novo', 'Cliente SA', null, 'admin');
\o
       reset role;
       select 'L10 provision (empresa nova)           : ' || t.name || ' ' || t.plan || '/' || t.subscription_status || ' role=' || p.role || ' tenants_orfaos=' || (select count(*) from tenants t2 where not exists (select 1 from profiles p2 where p2.tenant_id = t2.id))
       from profiles p join tenants t on t.id = p.tenant_id where p.email = 'novo@cliente.com'; rollback;
begin; set local role service_role;
\o /dev/null
       select user_id from provision_user_tenant('conv@a.com', 'SenhaForte123', 'Convidado', null, (select tenant_id from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'colaborador');
\o
       reset role;
       select 'L11 provision (tenant existente)       : ' || p.role || ' mesmo_tenant=' || (p.tenant_id = (select tenant_id from profiles where id = '00000000-0000-0000-0000-0000000000a1'))::text || ' tenants_orfaos=' || (select count(*) from tenants t2 where not exists (select 1 from profiles p2 where p2.tenant_id = t2.id))
       from profiles p where p.email = 'conv@a.com'; rollback;

-- ============================================================================
-- MURAL / AUTOATENDIMENTO (0013_mural + 0015_mural_hardening)
-- ============================================================================
-- Semente (como postgres, fora de transação): 1 post e 2 enquetes na empresa A.
--   enquete "anon"  (anônima):    c1 e r1 votaram
--   enquete "aberta" (não anôn.): c1 votou
insert into posts (id, tenant_id, author_id, body)
  values ('00000000-0000-0000-0000-00000000f001', :A, '00000000-0000-0000-0000-0000000000a1', 'comunicado da empresa A');
insert into polls (id, tenant_id, author_id, question, anonymous) values
  ('00000000-0000-0000-0000-00000000f101', :A, '00000000-0000-0000-0000-0000000000a1', 'Enquete anonima?', true),
  ('00000000-0000-0000-0000-00000000f102', :A, '00000000-0000-0000-0000-0000000000a1', 'Enquete aberta?', false);
insert into poll_options (id, poll_id, tenant_id, label) values
  ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f101', :A, 'sim'),
  ('00000000-0000-0000-0000-00000000f202', '00000000-0000-0000-0000-00000000f102', :A, 'sim');
insert into poll_votes (poll_id, option_id, profile_id, tenant_id) values
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-0000000000c1', :A),
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-0000000000d1', :A),
  ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-00000000f202', '00000000-0000-0000-0000-0000000000c1', :A);

\echo '--- MURAL: ATAQUES (esperado: ERR ou rows=0)'
begin; select 'M1 sessão sem 2FA (aal1) lê o mural      : ' || t_count(:'c1_aal1', $$select * from posts$$); rollback;
begin; select 'M2 empresa B lê o mural da empresa A     : ' || t_count(:'b1', $$select * from posts$$); rollback;
begin; select 'M3 colaborador escreve post direto (REST): ' || t_exec(:'c1', format($$insert into posts (tenant_id, author_id, body) values (%L, '00000000-0000-0000-0000-0000000000c1', 'x')$$, (select tenant_id from profiles where id='00000000-0000-0000-0000-0000000000a1'))); rollback;
begin; select 'M4 admin lê votos da enquete ANÔNIMA      : ' || t_count(:'a1', $$select * from poll_votes where poll_id = '00000000-0000-0000-0000-00000000f101'$$); rollback;
begin; select 'M5 RH lê votos de OUTROS na anônima       : ' || t_count(:'r1', $$select * from poll_votes where poll_id = '00000000-0000-0000-0000-00000000f101' and profile_id <> '00000000-0000-0000-0000-0000000000d1'$$); rollback;
begin; select 'M6 colaborador vota no lugar de outro     : ' || t_exec(:'c1', $$insert into poll_votes (poll_id, option_id, profile_id, tenant_id) select poll_id, id, '00000000-0000-0000-0000-0000000000a1', tenant_id from poll_options where poll_id = '00000000-0000-0000-0000-00000000f102'$$); rollback;

\echo '--- MURAL: USO LEGÍTIMO (esperado: rows>0 / OK)'
begin; select 'ML1 colaborador (aal2) lê o mural         : ' || t_count(:'c1', $$select * from posts$$); rollback;
begin; select 'ML2 colaborador vê o PRÓPRIO voto (anôn.) : ' || t_count(:'c1', $$select * from poll_votes where poll_id = '00000000-0000-0000-0000-00000000f101'$$); rollback;
begin; select 'ML3 admin lê votos da enquete ABERTA       : ' || t_count(:'a1', $$select * from poll_votes where poll_id = '00000000-0000-0000-0000-00000000f102'$$); rollback;
begin; select 'ML4 service_role grava post (como a API)   : ' || t_exec(:'svc', format($$insert into posts (tenant_id, author_id, body) values (%L, '00000000-0000-0000-0000-0000000000a1', 'via api')$$, (select tenant_id from profiles where id='00000000-0000-0000-0000-0000000000a1'))); rollback;
