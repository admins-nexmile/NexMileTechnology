-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.11 (employee documents)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK (storage object rows inserted
-- here are metadata only and are rolled back). Failures raise
-- "FAIL: ..."; success returns "ALL TESTS PASSED".
--
-- Accounts: h101 employee NX005; h102 employee NX004; h103 hr_admin NX002.
--
--  1. bucket exists and is private, with size and type limits
--  2. hr_admin may upload only into an existing employee's folder;
--     employees cannot upload
--  3. doc_register: HR only; path must be the employee's folder and exist
--  4. employee sees only own NON-confidential documents (list, path,
--     storage SELECT used by signed URLs); confidential ones need
--     employees.manage
--  5. another employee sees nothing of NX005's documents
--  6. HR sees and reads everything; doc_delete returns the path
--  7. anon cannot use document functions; table stays locked
-- =====================================================================

begin;

do $$
declare
  v_sa uuid;
begin
  select ur.user_id into v_sa from public.user_roles ur where ur.role_key = 'super_admin' limit 1;
  if v_sa is null then raise exception 'FAIL: setup: no super_admin'; end if;

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         v.email, now(), '{"provider":"google"}', '{}'::jsonb, now(), now()
  from (values
    ('00000000-0000-4000-8000-00000000b101', 't211.emp5@example.test'),
    ('00000000-0000-4000-8000-00000000b102', 't211.emp4@example.test'),
    ('00000000-0000-4000-8000-00000000b103', 't211.hr@example.test')
  ) as v(id, email);

  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000b101'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000b102'::uuid, 'NX004'),
    ('00000000-0000-4000-8000-00000000b103'::uuid, 'NX002'));
  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000b101', 'employee', v_sa),
    ('00000000-0000-4000-8000-00000000b102', 'employee', v_sa),
    ('00000000-0000-4000-8000-00000000b103', 'hr_admin', v_sa);

  perform set_config('test.nx005', (select id::text from public.employees where employee_code = 'NX005'), true);
  perform set_config('test.nx004', (select id::text from public.employees where employee_code = 'NX004'), true);

  -- 1
  if not exists (select 1 from storage.buckets
                 where id = 'employee-documents' and not public
                   and file_size_limit = 10485760
                   and allowed_mime_types @> array['application/pdf']) then
    raise exception 'FAIL: 1: bucket missing, public or without limits';
  end if;
end
$$;

-- 2 & 3 as hr_admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b103","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_folder text := current_setting('test.nx005');
  v_pub uuid;
  v_conf uuid;
begin
  insert into storage.objects (bucket_id, name, owner)
  values ('employee-documents', v_folder || '/t211-handbook.pdf', '00000000-0000-4000-8000-00000000b103'),
         ('employee-documents', v_folder || '/t211-contract.pdf', '00000000-0000-4000-8000-00000000b103');

  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('employee-documents', 'not-an-employee/x.pdf', '00000000-0000-4000-8000-00000000b103');
    raise exception 'FAIL: 2: upload outside an employee folder allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.doc_register(current_setting('test.nx004')::uuid, 'Wrong', 'OTHER',
                                v_folder || '/t211-handbook.pdf', false);
    raise exception 'FAIL: 3: file registered to a different employee';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'The file must be stored in the employee''s folder%' then raise exception 'FAIL: 3: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.doc_register(v_folder::uuid, 'Missing', 'OTHER', v_folder || '/missing.pdf', false);
    raise exception 'FAIL: 3: missing file registered';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'The uploaded file was not found%' then raise exception 'FAIL: 3: unexpected: %', sqlerrm; end if;
  end;

  v_pub  := public.doc_register(v_folder::uuid, 'T211 Handbook', 'POLICY', v_folder || '/t211-handbook.pdf', false);
  v_conf := public.doc_register(v_folder::uuid, 'T211 Contract', 'CONTRACT', v_folder || '/t211-contract.pdf', true);
  perform set_config('test.doc_pub', v_pub::text, true);
  perform set_config('test.doc_conf', v_conf::text, true);

  -- 6 (read side)
  if public.doc_get_path(v_conf) <> v_folder || '/t211-contract.pdf' then
    raise exception 'FAIL: 6: HR cannot read confidential document path';
  end if;
  if (select count(*) from storage.objects
      where bucket_id = 'employee-documents' and name like v_folder || '/t211-%') <> 2 then
    raise exception 'FAIL: 6: HR cannot see the stored files';
  end if;
  if (select count(*) from public.admin_list_documents(v_folder::uuid) where document_name like 'T211 %') <> 2 then
    raise exception 'FAIL: 6: admin_list_documents incomplete';
  end if;
end
$$;
reset role;

-- 4. employee NX005
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b101","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.my_documents() where id = current_setting('test.doc_conf')::uuid)
     or not exists (select 1 from public.my_documents() where id = current_setting('test.doc_pub')::uuid) then
    raise exception 'FAIL: 4: my_documents wrong';
  end if;
  perform public.doc_get_path(current_setting('test.doc_pub')::uuid);
  begin
    perform public.doc_get_path(current_setting('test.doc_conf')::uuid);
    raise exception 'FAIL: 4: employee read confidential document path';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Document not found%' then raise exception 'FAIL: 4: unexpected: %', sqlerrm; end if;
  end;
  if (select count(*) from storage.objects where bucket_id = 'employee-documents') <> 1
     or not exists (select 1 from storage.objects where name like '%/t211-handbook.pdf') then
    raise exception 'FAIL: 4: employee storage visibility wrong';
  end if;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('employee-documents', current_setting('test.nx005') || '/mine.pdf', '00000000-0000-4000-8000-00000000b101');
    raise exception 'FAIL: 2: employee uploaded a file';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.doc_register(current_setting('test.nx005')::uuid, 'Mine', 'OTHER',
                                current_setting('test.nx005') || '/t211-handbook.pdf', false);
    raise exception 'FAIL: 3: employee registered a document';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You do not have permission%' then raise exception 'FAIL: 3: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform count(*) from public.employee_documents;
    raise exception 'FAIL: 7: employee queried employee_documents directly';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 5. employee NX004
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b102","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'employee-documents') <> 0 then
    raise exception 'FAIL: 5: other employee sees stored files';
  end if;
  begin
    perform public.doc_get_path(current_setting('test.doc_pub')::uuid);
    raise exception 'FAIL: 5: other employee read a document path';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  if exists (select 1 from public.my_documents() where id = current_setting('test.doc_pub')::uuid) then
    raise exception 'FAIL: 5: other employee lists NX005 document';
  end if;
end
$$;
reset role;

-- 6. delete as HR
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b103","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.doc_delete(current_setting('test.doc_conf')::uuid) not like '%/t211-contract.pdf' then
    raise exception 'FAIL: 6: doc_delete did not return the storage path';
  end if;
end
$$;
reset role;

-- 7. anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform * from public.my_documents();
  raise exception 'FAIL: 7: anon executed my_documents';
exception when insufficient_privilege then null;
end
$$;
reset role;

select 'ALL TESTS PASSED' as result;

rollback;
