-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.11 (employee documents)
-- =====================================================================
-- Run manually, only after explicit approval.
--
-- Precondition: the bucket must be EMPTY. Supabase blocks direct SQL
-- deletes from storage.objects, so remove files first through the Storage
-- API or dashboard (download them to a backup first), and export
-- employee_documents to database/backups/. This script refuses to run
-- while files remain.
--
-- Drops the storage policies, helpers, document functions, the bucket,
-- the storage_path unique index and employee_documents.uploaded_by (its
-- values are lost). employee_documents rows are kept.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('app_private.doc_register(uuid,text,text,text,boolean)') is null then
    raise exception 'rollback 2.11 aborted: 2.11 objects not found';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'employee-documents') then
    raise exception 'rollback 2.11 aborted: bucket employee-documents still contains files';
  end if;
  if to_regprocedure('app_private.audit_list(integer,integer,text)') is not null then
    raise exception 'rollback 2.11 aborted: roll back 2.12 first';
  end if;
end
$$;

drop policy employee_documents_select on storage.objects;
drop policy employee_documents_insert on storage.objects;
drop policy employee_documents_delete on storage.objects;

do $$
declare
  f text;
begin
  foreach f in array array[
    'doc_register(uuid,text,text,text,boolean)', 'doc_set_confidential(uuid,boolean)',
    'doc_delete(uuid)', 'admin_list_documents(uuid)', 'my_documents()', 'doc_get_path(uuid)']
  loop
    execute format('drop function public.%s', f);
    execute format('drop function app_private.%s', f);
  end loop;
end
$$;
drop function app_private.can_read_document_object(text);
drop function app_private.is_employee_folder(text);

delete from storage.buckets where id = 'employee-documents';

drop index public.employee_documents_storage_path_key;
drop index public.employee_documents_uploaded_by_idx;
alter table public.employee_documents drop column uploaded_by;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.11', 'at', now()), null);

commit;
