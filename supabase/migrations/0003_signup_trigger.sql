-- ============================================================================
-- SIGNUP AUTOMÁTICO: quando alguém se cadastra, cria o tenant (empresa) e
-- o profile (usuário) automaticamente, como 'admin' da própria empresa.
-- ============================================================================
-- O front-end de cadastro chama supabase.auth.signUp() passando
-- options.data = { full_name, company_name }. Este trigger lê esses
-- metadados e monta tenant + profile numa transação — sem isso, o usuário
-- ficaria autenticado mas "órfão" (sem empresa e sem profile).

create or replace function handle_new_user()
returns trigger as $$
declare
  new_tenant_id uuid;
  company_name text;
  full_name text;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  company_name := coalesce(new.raw_user_meta_data->>'company_name', 'Minha Empresa');
  full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  base_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  final_slug := base_slug;
  while exists (select 1 from tenants where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into tenants (name, slug)
  values (company_name, final_slug)
  returning id into new_tenant_id;

  insert into profiles (id, tenant_id, full_name, email, role)
  values (new.id, new_tenant_id, full_name, new.email, 'admin');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
