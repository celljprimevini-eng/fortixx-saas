-- ============================================================================
-- 0015 — HARDENING DO MURAL / AUTOATENDIMENTO (revisão de 2026-10-25)
-- ============================================================================
-- Depois de 0013_mural_autoatendimento (tabelas novas) e 0014_security_hardening
-- (2FA no banco). Idempotente: pode rodar de novo sem efeito colateral.
--
-- 1. 2FA OBRIGATÓRIO TAMBÉM NAS TABELAS NOVAS.
--    O loop da 0014 cria a policy RESTRICTIVE `require_aal2` só nas tabelas que
--    JÁ existiam na hora em que ele rodou. As tabelas do Mural/Autoatendimento
--    (posts, polls, leave_requests, signature_requests, push_subscriptions...)
--    nascem na 0013_mural, e se a ordem de aplicação for qualquer outra, elas
--    ficam sem a regra: uma sessão só com senha (aal1) leria posts, pedidos de
--    férias e documentos para assinar direto pela API REST do Supabase.
--    Aqui o loop roda de novo e cobre TUDO que tem RLS ligado.
--
-- 2. ENQUETE ANÔNIMA NÃO PODE SER LIDA POR ADMIN/RH.
--    A policy `poll_votes_select_own` deixava admin e RH lerem TODAS as linhas
--    de poll_votes (com profile_id) pelo PostgREST — o que revela quem votou em
--    quê mesmo numa enquete marcada como anônima. A API do Mural já devolve só
--    contagens, mas a promessa de anonimato tem que valer no banco, não só na
--    tela. Agora: o próprio voto sempre; admin/RH só enxergam votos de enquetes
--    NÃO anônimas.
-- ============================================================================

-- 1) require_aal2 em todas as tabelas com RLS (inclui as novas)
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

-- 2) anonimato real nas enquetes
drop policy if exists "poll_votes_select_own" on poll_votes;
create policy "poll_votes_select_own" on poll_votes for select
  using (
    tenant_id = auth_tenant_id()
    and (
      profile_id = auth.uid()
      or (
        auth_role() in ('admin','rh')
        and not exists (
          select 1 from polls p
          where p.id = poll_votes.poll_id and p.anonymous
        )
      )
    )
  );
