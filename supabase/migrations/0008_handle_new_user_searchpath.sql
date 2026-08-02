-- ============================================================================
-- FIX: handle_new_user() não tem SET search_path
-- ============================================================================
-- O trigger handle_new_user() foi criado SEM SET search_path. Quando
-- rodando dentro de outra função que define search_path = '' (como a
-- provision_user_tenant RPC), o trigger herda esse search_path e não
-- consegue resolver 'tenants' nem 'profiles'.
--
-- O trigger é SECURITY DEFINER mas mesmo assim o search_path é avaliado
-- dentro do escopo da função — e ele não tem SET explícito, então o
-- Postgres usa o search_path da sessão (que em RPCs security definer
-- costuma ser '').
--
-- Solução: recriar handle_new_user() com SET search_path = public, pg_catalog.
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
  company_name := coalesce(new.raw_user_meta_data->>'company_name', 'Minha Empresa');
  full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  plan_value := coalesce(new.raw_user_meta_data->>'plan', 'basico');
  status_value := coalesce(new.raw_user_meta_data->>'subscription_status', 'trialing');

  base_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g'));
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

-- Trigger já existe, não precisa recriar (a função mudou)
-- (se necessário: drop trigger on_auth_user_created on auth.users;
--  create trigger on_auth_user_created after insert on auth.users
--    for each row execute function public.handle_new_user();)