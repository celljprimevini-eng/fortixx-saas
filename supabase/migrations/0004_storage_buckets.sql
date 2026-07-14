-- ============================================================================
-- STORAGE: bucket de documentos com isolamento por tenant no caminho do arquivo
-- ============================================================================
-- Convenção de path obrigatória: {tenant_id}/{profile_id}/{filename}
-- As políticas abaixo travam upload/leitura para bater com o tenant do
-- usuário autenticado, usando o primeiro segmento do path como tenant_id.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select"
on storage.objects for select
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth_tenant_id()::text
);

create policy "documents_storage_insert"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth_tenant_id()::text
);

create policy "documents_storage_delete"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth_tenant_id()::text
  and auth_role() in ('admin','rh')
);

-- Bucket separado para avatares — pode ser público (não contém dado sensível)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_storage_select_public"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
