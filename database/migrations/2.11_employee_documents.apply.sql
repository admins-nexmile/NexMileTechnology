-- =====================================================================
-- Nexmile HRMS â€” Migration 2.11: private employee document storage
-- =====================================================================
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.10 applied.
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_11_employee_documents); tests ALL TESTS PASSED.
-- Rollback: database/migrations/2.11_employee_documents.rollback.sql
-- Test:     database/tests/2.11_employee_documents_tests.sql
--
-- Applied through Supabase MCP apply_migration (one transaction).
--
-- Storage
--   * Private bucket "employee-documents" (public = false, 10 MB limit,
--     PDF / PNG / JPEG only). Object names: <employee_id>/<file>.
--   * Policies on storage.objects for this bucket only:
--       SELECT  employees.manage, or the employee's own NON-confidential
--               document registered in employee_documents (this is what
--               createSignedUrl checks; no public URLs exist)
--       INSERT  employees.manage, first folder must be an employee id
--       DELETE  employees.manage
--     No UPDATE policy (files are replaced by delete + upload).
--
-- employee_documents (table stays locked to API roles; functions only)
--   * adds uploaded_by (auth user) and a unique index on storage_path.
--   * doc_register / doc_set_confidential / doc_delete   employees.manage
--   * admin_list_documents(employee)                      employees.manage
--   * my_documents()          own non-confidential documents
--   * doc_get_path(id)        storage path for a short-lived signed URL;
--                             own non-confidential or employees.manage
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.payroll_create_run(text,date,date,date,text)') is null then
    raise exception '2.11 aborted: migration 2.10 not found';
  end if;
  if to_regprocedure('app_private.doc_register(uuid,text,text,text,boolean)') is not null then
    raise exception '2.11 aborted: 2.11 objects already exist';
  end if;
  if exists (select 1 from storage.buckets where id = 'employee-documents') then
    raise exception '2.11 aborted: bucket employee-documents already exists';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'employee_documents_%') then
    raise exception '2.11 aborted: employee_documents storage policies already exist';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception '2.11 aborted: RLS is not enabled on storage.objects';
  end if;
  if exists (select storage_path from public.employee_documents
             where storage_path is not null group by storage_path having count(*) > 1) then
    raise exception '2.11 aborted: duplicate employee_documents.storage_path values';
  end if;
  if has_table_privilege('authenticated', 'public.employee_documents', 'SELECT') then
    raise exception '2.11 aborted: employee_documents is readable by authenticated';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Table additions (non-destructive)
-- ---------------------------------------------------------------------
alter table public.employee_documents
  add column uploaded_by uuid references auth.users (id) on delete set null;
create index employee_documents_uploaded_by_idx on public.employee_documents (uploaded_by);
create unique index employee_documents_storage_path_key
  on public.employee_documents (storage_path) where storage_path is not null;

-- ---------------------------------------------------------------------
-- 2. Private bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-documents', 'employee-documents', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg']);

-- ---------------------------------------------------------------------
-- 3. Helpers used by storage policies
-- ---------------------------------------------------------------------
create function app_private.can_read_document_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_permission('employees.manage')
      or exists (
           select 1
           from public.employee_documents d
           where d.storage_path = p_name
             and not d.is_confidential
             and d.employee_id = app_private.my_employee_id()
         );
$$;

-- True when the object's first folder is an existing employee id.
create function app_private.is_employee_folder(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.id::text = split_part(p_name, '/', 1)
  ) and p_name ~ '^[0-9a-f-]{36}/[^/]+$';
$$;

revoke all on function app_private.can_read_document_object(text) from public, anon, service_role;
revoke all on function app_private.is_employee_folder(text)       from public, anon, service_role;
grant execute on function app_private.can_read_document_object(text) to authenticated;
grant execute on function app_private.is_employee_folder(text)       to authenticated;

-- ---------------------------------------------------------------------
-- 4. Storage policies (this bucket only)
-- ---------------------------------------------------------------------
create policy employee_documents_select on storage.objects
  for select to authenticated
  using (bucket_id = 'employee-documents' and app_private.can_read_document_object(name));

create policy employee_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'employee-documents'
    and (select app_private.has_permission('employees.manage'))
    and app_private.is_employee_folder(name)
  );

create policy employee_documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'employee-documents' and (select app_private.has_permission('employees.manage')));

-- ---------------------------------------------------------------------
-- 5. Document functions
-- ---------------------------------------------------------------------
create function app_private.doc_register(
  p_employee_id uuid, p_name text, p_category text, p_storage_path text, p_is_confidential boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := app_private.require_permission('employees.manage');
  v_name text := app_private.clean_text(p_name, 200, 'Document name', true);
  v_id   uuid;
begin
  if p_category is null or p_category not in
     ('POLICY', 'CONTRACT', 'OFFER_LETTER', 'ID_PROOF', 'CERTIFICATE', 'TAX', 'OTHER') then
    raise exception 'Choose a document category.';
  end if;
  if not exists (select 1 from public.employees where id = p_employee_id) then
    raise exception 'Employee not found.';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> p_employee_id::text
     or not app_private.is_employee_folder(p_storage_path) then
    raise exception 'The file must be stored in the employee''s folder.';
  end if;
  if not exists (select 1 from storage.objects o
                 where o.bucket_id = 'employee-documents' and o.name = p_storage_path) then
    raise exception 'The uploaded file was not found.';
  end if;
  if exists (select 1 from public.employee_documents where storage_path = p_storage_path) then
    raise exception 'This file is already registered.';
  end if;

  insert into public.employee_documents
    (employee_id, document_name, document_category, storage_path, is_confidential, uploaded_by)
  values (p_employee_id, v_name, p_category, p_storage_path, coalesce(p_is_confidential, true), v_uid)
  returning id into v_id;

  perform app_private.write_audit('document_registered', 'employee_document', v_id,
    pg_catalog.jsonb_build_object('employee_id', p_employee_id, 'name', v_name,
                                  'category', p_category, 'confidential', coalesce(p_is_confidential, true)));
  return v_id;
end;
$$;

create function app_private.doc_set_confidential(p_id uuid, p_is_confidential boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_permission('employees.manage');
  if p_is_confidential is null then
    raise exception 'Choose confidential or not.';
  end if;
  update public.employee_documents set is_confidential = p_is_confidential where id = p_id;
  if not found then
    raise exception 'Document not found.';
  end if;
  perform app_private.write_audit('document_confidentiality_set', 'employee_document', p_id,
    pg_catalog.jsonb_build_object('confidential', p_is_confidential));
end;
$$;

-- Deletes the record and returns its storage path so the caller can remove
-- the file (storage DELETE policy: employees.manage).
create function app_private.doc_delete(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.employee_documents%rowtype;
begin
  perform app_private.require_permission('employees.manage');
  delete from public.employee_documents where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Document not found.';
  end if;
  perform app_private.write_audit('document_deleted', 'employee_document', p_id,
    pg_catalog.jsonb_build_object('employee_id', v_row.employee_id, 'name', v_row.document_name,
                                  'storage_path', v_row.storage_path));
  return v_row.storage_path;
end;
$$;

create function app_private.admin_list_documents(p_employee_id uuid default null)
returns table (
  id uuid, employee_id uuid, employee_code text, employee_name text,
  document_name text, document_category text, is_confidential boolean,
  has_file boolean, uploaded_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_permission('employees.manage');
  return query
  select d.id, d.employee_id, e.employee_code,
         app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
         d.document_name, d.document_category, d.is_confidential,
         d.storage_path is not null, d.uploaded_at
  from public.employee_documents d
  join public.employees e on e.id = d.employee_id
  where p_employee_id is null or d.employee_id = p_employee_id
  order by d.uploaded_at desc
  limit 1000;
end;
$$;

create function app_private.my_documents()
returns table (id uuid, document_name text, document_category text, has_file boolean, uploaded_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := app_private.require_my_employee();
begin
  return query
  select d.id, d.document_name, d.document_category, d.storage_path is not null, d.uploaded_at
  from public.employee_documents d
  where d.employee_id = v_me and not d.is_confidential
  order by d.uploaded_at desc;
end;
$$;

create function app_private.doc_get_path(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.employee_documents%rowtype;
begin
  select * into v_row from public.employee_documents where id = p_id;
  if not found
     or not (app_private.has_permission('employees.manage')
             or (not v_row.is_confidential and v_row.employee_id = app_private.my_employee_id())) then
    raise exception 'Document not found.';
  end if;
  if v_row.storage_path is null then
    raise exception 'This document has no file attached.';
  end if;
  return v_row.storage_path;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Public wrappers and privileges
-- ---------------------------------------------------------------------
create function public.doc_register(p_employee_id uuid, p_name text, p_category text, p_storage_path text, p_is_confidential boolean) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.doc_register(p_employee_id, p_name, p_category, p_storage_path, p_is_confidential); $$;
create function public.doc_set_confidential(p_id uuid, p_is_confidential boolean) returns void
language sql security invoker set search_path = '' as $$ select app_private.doc_set_confidential(p_id, p_is_confidential); $$;
create function public.doc_delete(p_id uuid) returns text
language sql security invoker set search_path = '' as $$ select app_private.doc_delete(p_id); $$;
create function public.admin_list_documents(p_employee_id uuid default null)
returns table (id uuid, employee_id uuid, employee_code text, employee_name text,
               document_name text, document_category text, is_confidential boolean,
               has_file boolean, uploaded_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from app_private.admin_list_documents(p_employee_id); $$;
create function public.my_documents()
returns table (id uuid, document_name text, document_category text, has_file boolean, uploaded_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from app_private.my_documents(); $$;
create function public.doc_get_path(p_id uuid) returns text
language sql stable security invoker set search_path = '' as $$ select app_private.doc_get_path(p_id); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'doc_register(uuid,text,text,text,boolean)', 'doc_set_confidential(uuid,boolean)',
    'doc_delete(uuid)', 'admin_list_documents(uuid)', 'my_documents()', 'doc_get_path(uuid)']
  loop
    execute format('revoke all on function app_private.%s from public, anon, service_role', f);
    execute format('grant execute on function app_private.%s to authenticated', f);
    execute format('revoke all on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

commit;
