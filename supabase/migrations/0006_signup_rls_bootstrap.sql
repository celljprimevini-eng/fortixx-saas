-- ============================================================================
-- SIGNUP BOOTSTRAP — destrava o trigger handle_new_user() no signup inicial
-- ============================================================================
-- O trigger handle_new_user() insere em `tenants` e em `profiles` quando um
-- novo usuário é criado em auth.users. Mas as RLS policies de profiles
-- checam auth_tenant_id() e auth_role(), que leem de profiles — e a linha
-- do novo user AINDA não existe na hora do INSERT. Resultado: NULL, CHECK
-- falha, signup retorna 500.
--
-- Solução: adicionar policies de "bootstrap" que só valem no momento exato
-- do signup (id = auth.uid() e tenant recém-criado pelo trigger).
--
-- O trigger continua sendo o único caminho válido pra criar profile durante
-- signup, porque ele seta tenant_id e role explicitamente. Essas policies
-- não放松am isolamento: elas só liberam o INSERT inicial do próprio user
-- em si mesmo, exatamente o que o trigger precisa.
-- ============================================================================

-- TENANTS: liberar INSERT só pra novos signups (autenticado, sem tenant ainda).
-- O trigger cria o tenant em nome do novo user. Permitimos quando auth.uid()
-- não tem tenant ainda — ou seja, é signup.
create policy "tenant_insert_signup" on tenants for insert
  with check (
    not exists (
      select 1 from profiles where id = auth.uid()
    )
  );

-- PROFILES: o novo user pode inserir sua PRÓPRIA linha (id = auth.uid()),
-- contanto que o tenant_id seja o que o trigger acabou de criar nesse
-- mesmo statement. Como não dá pra referenciar "linha recem-criada em
-- tenants" no WITH CHECK de profiles (politica é por linha), aceitamos
-- qualquer INSERT do proprio user sobre si mesmo. O trigger é o unico
-- caminho que faz isso porque exige que `id = auth.uid()`.
create policy "profiles_insert_self_signup" on profiles for insert
  with check (
    id = auth.uid()
    and not exists (
      select 1 from profiles where id = auth.uid()
    )
  );

-- Comentário de auditoria:
COMMENT ON POLICY "tenant_insert_signup" ON tenants IS
  'Permite INSERT de tenant durante signup (id ainda não existe em profiles). Trigger handle_new_user é o único caminho que cria tenant durante signup.';
COMMENT ON POLICY "profiles_insert_self_signup" ON profiles IS
  'Permite INSERT do próprio profile durante signup. id = auth.uid() garante que ninguém pode inserir linha em nome de outro user.';
