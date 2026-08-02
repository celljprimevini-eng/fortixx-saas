-- ============================================================================
-- RPC: provision_user_tenant — cria user + tenant + profile em uma transação
-- ============================================================================
-- Encapsula o fluxo de onboarding (novo cliente assina Stripe → admin
-- fundador chama /api/onboarding → cria user+tenant+profile).
--
-- Por que uma RPC e não route.ts com 3 INSERTs?
-- - Atomicidade: se algo falhar, nenhum dado fica inconsistente
-- - bcrypt hash roda no proprio Postgres (sem dependencia de npm bcrypt)
-- - Bypassa RLS (security definer) — só o admin fundador pode chamar
-- - Funciona via supabaseAdmin.rpc(...) sem precisar de node-postgres
--
-- Como chamar:
--   supabaseAdmin.rpc('provision_user_tenant', {
--     p_email: 'cliente@empresa.com',
--     p_password: 'SenhaSegura123!',
--     p_full_name: 'João Silva',
--     p_company_name: 'Empresa X',     -- null = usa parte do email
--     p_existing_tenant_id: null,       -- UUID = vincula ao tenant existente
--     p_role: 'admin'                    -- 'admin' | 'rh' | 'gestor' | 'colaborador'
--   })
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
  v_user_id uuid;
  v_tenant_id uuid;
  v_company_name text;
  v_base_slug text;
  v_final_slug text;
  v_suffix int := 0;
  v_trigger_disabled boolean := false;
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

  -- Verifica se user já existe (qualifica schema pq 'email' também é param)
  if exists (select 1 from auth.users where auth.users.email = p_email) then
    raise exception 'user com email % já existe', p_email;
  end if;

  -- Decide tenant: existente OU cria novo
  if p_existing_tenant_id is not null then
    if not exists (select 1 from public.tenants where public.tenants.id = p_existing_tenant_id) then
      raise exception 'tenant % não existe', p_existing_tenant_id;
    end if;
    v_tenant_id := p_existing_tenant_id;
  else
    v_company_name := coalesce(nullif(trim(p_company_name), ''), split_part(p_email, '@', 1));
    v_base_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_base_slug := trim(both '-' from v_base_slug);
    if v_base_slug = '' then
      v_base_slug := 'tenant';
    end if;
    v_final_slug := v_base_slug;

    while exists (select 1 from public.tenants where public.tenants.slug = v_final_slug) loop
      v_suffix := v_suffix + 1;
      v_final_slug := v_base_slug || '-' || v_suffix;
    end loop;

    insert into public.tenants (name, slug, plan, subscription_status)
    values (v_company_name, v_final_slug, 'pro', 'active')
    returning public.tenants.id into v_tenant_id;
  end if;

  v_user_id := gen_random_uuid();

  -- Garante que o trigger handle_new_user() consiga resolver 'tenants'
  -- e 'profiles' (ele NÃO é security definer — mas está fixado a public).
  -- Aqui o trigger roda com o search_path do caller. Restauramos no fim.
  perform set_config('search_path', 'public, pg_catalog, extensions', true);

  declare
    v_trigger_tenant_id uuid;
  begin
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
      jsonb_build_object('provider', 'email', 'providers', array['email']::text[]),
      jsonb_build_object('full_name', p_full_name),
      now(), now(),
      '', '', '',
      '', '',
      '', '',
      false, false
    );

    -- O trigger criou um tenant automaticamente (slug baseado no email/company_name)
    -- e o profile com role='admin'. Ajustamos conforme parâmetros:
    select public.profiles.tenant_id into v_trigger_tenant_id
      from public.profiles where public.profiles.id = v_user_id;

    if p_existing_tenant_id is not null then
      -- Vincula ao tenant existente, deleta o tenant criado pelo trigger
      update public.profiles
        set tenant_id = p_existing_tenant_id, role = p_role
        where public.profiles.id = v_user_id;
      v_tenant_id := p_existing_tenant_id;
      delete from public.tenants where public.tenants.id = v_trigger_tenant_id and public.tenants.id != p_existing_tenant_id;
    else
      -- Trigger criou tenant novo — usa ele (ajusta role se passado != admin)
      v_tenant_id := v_trigger_tenant_id;
      if p_role != 'admin' then
        update public.profiles set role = p_role where public.profiles.id = v_user_id;
      end if;
    end if;
  end;

  perform set_config('search_path', '', true);  -- restaura

  return query select v_user_id, v_tenant_id, p_email, p_role;
end;
$$;

-- Apenas service_role pode chamar (security definer já bypassa RLS)
revoke all on function provision_user_tenant(text, text, text, text, uuid, text)
  from public, anon, authenticated;

comment on function provision_user_tenant is
  'Provisiona user + tenant + profile atomicamente. Service-role only. Chamada via /api/onboarding (admin-only).';
