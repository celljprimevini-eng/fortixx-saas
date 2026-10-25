-- ============================================================================
-- 0014 — HARDENING DE SEGURANÇA (auditoria de 2026-09-30)
-- ============================================================================
-- Fecha os furos encontrados na auditoria. Todos foram reproduzidos num
-- Postgres local com os stubs do Supabase antes da correção:
--
--  1. Colaborador/RH se promovia a admin: a policy profiles_update_own_or_admin_rh
--     não tem WITH CHECK, então o próprio usuário podia trocar o `role` do seu
--     perfil direto pela API REST do Supabase (chave anon + JWT dele).
--  2. Admin liberava o próprio plano sem pagar: tenant_update_admin deixava
--     alterar plan / subscription_status / ids de cobrança.
--  3. Signup aceitava `plan` e `subscription_status` vindos do navegador
--     (raw_user_meta_data é controlado pelo usuário no supabase.auth.signUp).
--  4. Policies de "bootstrap" (0006) deixavam um usuário sem perfil (ex.:
--     ex-funcionário cujo perfil foi apagado) criar perfil de admin em QUALQUER
--     tenant, e deixavam o anônimo inserir empresas. O trigger de signup não
--     depende delas: ele é SECURITY DEFINER e roda sem auth.uid(), então nunca
--     passaria por profiles_insert_self_signup de qualquer jeito.
--  5. Storage `documents`: qualquer usuário da empresa baixava RG/CPF/
--     comprovante de todos os colegas (a tabela restringia, o bucket não).
--  6. 2FA só protegia as telas: uma sessão aal1 (só senha, sem o código TOTP)
--     lia e escrevia todos os dados pela API REST. Agora toda tabela exige
--     aal2 para o papel `authenticated` (policy RESTRICTIVE).
--  7. provision_user_tenant criava a empresa certa (nome/plano pagos) e depois
--     o trigger criava OUTRA ("Minha Empresa", básico/trial) — o cliente caía
--     na errada e a certa ficava órfã.
--
-- Backend (service_role), webhooks, scripts e o trigger de signup continuam
-- funcionando: service_role tem BYPASSRLS e os triggers-guarda abaixo liberam
-- quem não é um usuário final (sem auth.uid() ou com role service_role).
-- ============================================================================


-- ============================================================================
-- 1. PROFILES — colunas privilegiadas só mudam por quem pode
-- ============================================================================
create or replace function public.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor_role text;
begin
  -- Backend (service_role), trigger de signup e migrations: não há usuário
  -- final na requisição. Anônimo não chega aqui (nenhuma policy libera).
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  v_actor_role := public.auth_role();

  if tg_op = 'INSERT' then
    if new.role = 'admin' and v_actor_role is distinct from 'admin' then
      raise exception 'Apenas admin pode criar outro admin.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id then
    raise exception 'id e tenant_id do perfil não podem ser alterados.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if v_actor_role is distinct from 'admin' then
      raise exception 'Apenas admin pode alterar o papel de um usuário.' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'Ninguém pode alterar o próprio papel.' using errcode = '42501';
    end if;
  end if;

  -- Colaborador/gestor editando o próprio perfil: só dados pessoais
  -- (nome, telefone, avatar). Cargo, gestor, departamento, status e e-mail
  -- são geridos pelo RH.
  if v_actor_role not in ('admin', 'rh') then
    if new.email is distinct from old.email
       or new.status is distinct from old.status
       or new.manager_id is distinct from old.manager_id
       or new.department_id is distinct from old.department_id
       or new.job_title is distinct from old.job_title
       or new.two_factor_enabled is distinct from old.two_factor_enabled then
      raise exception 'Somente RH/Admin podem alterar esses campos.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on profiles;
create trigger trg_profiles_guard
  before insert or update on profiles
  for each row execute function public.guard_profile_write();


-- ============================================================================
-- 2. TENANTS — plano, status e ids de cobrança só pelo backend (webhooks)
-- ============================================================================
create or replace function public.guard_tenant_billing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.plan is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.cakto_customer_id is distinct from old.cakto_customer_id
     or new.cakto_subscription_id is distinct from old.cakto_subscription_id
     or new.billing_provider is distinct from old.billing_provider then
    raise exception 'Dados de cobrança só podem ser alterados pelo sistema de pagamento.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tenants_guard_billing on tenants;
create trigger trg_tenants_guard_billing
  before update on tenants
  for each row execute function public.guard_tenant_billing();


-- ============================================================================
-- 3. Remove as policies de bootstrap do signup (0006)
-- ============================================================================
drop policy if exists "tenant_insert_signup" on tenants;
drop policy if exists "profiles_insert_self_signup" on profiles;


-- ============================================================================
-- 4. SIGNUP — plano/status só a partir de raw_app_meta_data (que só o
--    servidor escreve), nunca do raw_user_meta_data enviado pelo navegador.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  new_tenant_id uuid;
  company_name text;
  full_name text;
  base_slug text;
  final_slug text;
  suffix int := 0;
  plan_value text;
  status_value text;
begin
  company_name := coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), 'Minha Empresa');
  full_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
  plan_value := coalesce(new.raw_app_meta_data->>'plan', 'basico');
  status_value := coalesce(new.raw_app_meta_data->>'subscription_status', 'trialing');

  base_slug := trim(both '-' from lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if base_slug = '' then
    base_slug := 'empresa';
  end if;
  final_slug := base_slug;
  while exists (select 1 from public.tenants where public.tenants.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.tenants (name, slug, plan, subscription_status)
  values (company_name, final_slug, plan_value, status_value)
  returning public.tenants.id into new_tenant_id;

  insert into public.profiles (id, tenant_id, full_name, email, role)
  values (new.id, new_tenant_id, full_name, new.email, 'admin');

  return new;
end;
$$;


-- ============================================================================
-- 5. PROVISION — o trigger cria a empresa já com nome/plano certos
-- ============================================================================
create or replace function provision_user_tenant(
  p_email text,
  p_password text,
  p_full_name text,
  p_company_name text default null,
  p_existing_tenant_id uuid default null,
  p_role text default 'admin'
)
returns table (
  user_id uuid,
  tenant_id uuid,
  email text,
  role text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_tenant_id uuid;
  v_trigger_tenant_id uuid;
  v_company_name text;
begin
  p_email := lower(trim(p_email));
  p_full_name := trim(p_full_name);

  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email inválido: %', p_email;
  end if;
  if length(p_password) < 8 then
    raise exception 'senha deve ter pelo menos 8 caracteres';
  end if;
  if p_role not in ('admin','rh','gestor','colaborador') then
    raise exception 'role inválido: %', p_role;
  end if;
  if exists (select 1 from auth.users where auth.users.email = p_email) then
    raise exception 'user com email % já existe', p_email;
  end if;
  if p_existing_tenant_id is not null
     and not exists (select 1 from public.tenants where public.tenants.id = p_existing_tenant_id) then
    raise exception 'tenant % não existe', p_existing_tenant_id;
  end if;

  v_company_name := coalesce(nullif(trim(p_company_name), ''), split_part(p_email, '@', 1));

  -- O trigger handle_new_user() cria tenant + profile(admin). Para empresa nova,
  -- já passamos nome e plano pago (app_metadata: só o servidor escreve).
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new,
    email_change_token_current, recovery_token,
    reauthentication_token, phone_change_token,
    is_sso_user, is_anonymous
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    jsonb_build_object(
      'provider', 'email', 'providers', array['email']::text[],
      'plan', 'pro', 'subscription_status', 'active'
    ),
    jsonb_build_object('full_name', p_full_name, 'company_name', v_company_name),
    now(), now(),
    '', '', '',
    '', '',
    '', '',
    false, false
  );

  select public.profiles.tenant_id into v_trigger_tenant_id
    from public.profiles where public.profiles.id = v_user_id;

  if p_existing_tenant_id is not null then
    -- Convite para empresa existente: move o perfil e apaga a empresa que o
    -- trigger criou.
    update public.profiles
      set tenant_id = p_existing_tenant_id, role = p_role
      where public.profiles.id = v_user_id;
    delete from public.tenants
      where public.tenants.id = v_trigger_tenant_id
        and public.tenants.id <> p_existing_tenant_id;
    v_tenant_id := p_existing_tenant_id;
  else
    v_tenant_id := v_trigger_tenant_id;
    if p_role <> 'admin' then
      update public.profiles set role = p_role where public.profiles.id = v_user_id;
    end if;
  end if;

  return query select v_user_id, v_tenant_id, p_email, p_role;
end;
$$;

revoke all on function provision_user_tenant(text, text, text, text, uuid, text)
  from public, anon, authenticated;


-- ============================================================================
-- 6. Policies de INSERT abertas demais
-- ============================================================================
-- documents: colaborador só registra documento próprio; RH/Admin de qualquer um.
drop policy if exists "documents_insert_own" on documents;
create policy "documents_insert_own" on documents for insert
  with check (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh'))
  );

-- notifications: ninguém manda notificação "do sistema" em nome de outro,
-- exceto RH/Admin/gestor.
drop policy if exists "notifications_insert_system" on notifications;
create policy "notifications_insert_system" on notifications for insert
  with check (
    tenant_id = auth_tenant_id()
    and (profile_id = auth.uid() or auth_role() in ('admin','rh','gestor'))
  );

-- audit_logs: só registra ação em nome de si mesmo (não forja o autor).
drop policy if exists "audit_insert_system" on audit_logs;
create policy "audit_insert_system" on audit_logs for insert
  with check (tenant_id = auth_tenant_id() and actor_id = auth.uid());


-- ============================================================================
-- 7. STORAGE `documents` — dono do arquivo ou RH/Admin
-- ============================================================================
-- Path: {tenant_id}/{profile_id}/{arquivo}. Currículos de candidatos ficam em
-- {tenant_id}/candidates/..., então só RH/Admin enxergam.
drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select"
on storage.objects for select
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth_tenant_id()::text
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or auth_role() in ('admin','rh')
  )
);

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth_tenant_id()::text
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or auth_role() in ('admin','rh')
  )
);


-- ============================================================================
-- 8. 2FA DE VERDADE — toda leitura/escrita de usuário logado exige aal2
-- ============================================================================
-- Policy RESTRICTIVE: é somada (AND) às permissivas existentes. Vale só para
-- o papel `authenticated`; service_role (backend) tem BYPASSRLS e o anônimo
-- continua sem acesso nenhum às tabelas de negócio.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity
  loop
    execute format('drop policy if exists "require_aal2" on public.%I', t.tablename);
    execute format(
      'create policy "require_aal2" on public.%I as restrictive for all to authenticated '
      'using ((select auth.jwt()->>''aal'') = ''aal2'') '
      'with check ((select auth.jwt()->>''aal'') = ''aal2'')',
      t.tablename
    );
  end loop;
end $$;

drop policy if exists "require_aal2" on storage.objects;
create policy "require_aal2" on storage.objects as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
