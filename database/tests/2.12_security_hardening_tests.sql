-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.12 (security hardening)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK. Failures raise "FAIL: ...";
-- success returns "ALL TESTS PASSED".
--
-- Accounts: c121 employee NX005; c122 hr_admin NX002; c123 payroll_admin
--           NX009; the real super_admin.
--
--  1. every public table has RLS enabled
--  2. public has exactly the intended policies, all SELECT-only
--  3. storage has exactly the three employee-documents policies
--  4. no function in public is executable by anon
--  5. rls_auto_enable is not executable by anon/authenticated, and a new
--     public table still gets RLS automatically
--  6. merged policies keep the same behaviour (profiles, user_roles)
--  7. audit viewer: super_admin only
--  8. default privileges: a new public function is not executable by
--     anon or PUBLIC; a new public table gives anon nothing
-- =====================================================================

begin;

do $$
declare
  v_sa uuid;
begin
  select ur.user_id into v_sa from public.user_roles ur where ur.role_key = 'super_admin' limit 1;
  if v_sa is null then raise exception 'FAIL: setup: no super_admin'; end if;
  perform set_config('test.sa', v_sa::text, true);

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         v.email, now(), '{"provider":"google"}', '{}'::jsonb, now(), now()
  from (values
    ('00000000-0000-4000-8000-00000000c121', 't212.employee@example.test'),
    ('00000000-0000-4000-8000-00000000c122', 't212.hr@example.test'),
    ('00000000-0000-4000-8000-00000000c123', 't212.payroll@example.test')
  ) as v(id, email);
  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000c121'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000c122'::uuid, 'NX002'),
    ('00000000-0000-4000-8000-00000000c123'::uuid, 'NX009'));
  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000c121', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000c122', 'hr_admin',      v_sa),
    ('00000000-0000-4000-8000-00000000c123', 'payroll_admin', v_sa);
end
$$;

-- 1–5 and 8 (catalogue checks as owner)
do $$
declare
  v_expected text[] := array[
    'announcements.announcements_select_audience',
    'attendance.attendance_select_scoped',
    'departments.departments_select_active',
    'employee_compensation.employee_compensation_select_compensation_read',
    'employees.employees_select_scoped',
    'holidays.holidays_select_active',
    'invitations.invitations_select_admin',
    'leave_requests.leave_requests_select_scoped',
    'leave_types.leave_types_select_active',
    'permissions.permissions_select_active',
    'profiles.profiles_select',
    'role_permissions.role_permissions_select_active',
    'roles.roles_select_active',
    'training_courses.training_courses_select_active',
    'training_enrollments.training_enrollments_select_scoped',
    'user_roles.user_roles_select'];
  v_actual text[];
  v_bad    text;
begin
  -- 1
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v_bad is not null then raise exception 'FAIL: 1: RLS disabled on %', v_bad; end if;

  -- 2
  select array_agg(tablename || '.' || policyname order by tablename || '.' || policyname)
    into v_actual from pg_policies where schemaname = 'public';
  if v_actual is distinct from v_expected then
    raise exception 'FAIL: 2: unexpected public policies: %', v_actual;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and cmd <> 'SELECT') then
    raise exception 'FAIL: 2: a public policy allows writes';
  end if;

  -- 3
  select array_agg(policyname || ':' || cmd order by policyname) into v_actual
  from pg_policies where schemaname = 'storage';
  if v_actual is distinct from array['employee_documents_delete:DELETE', 'employee_documents_insert:INSERT',
                                     'employee_documents_select:SELECT'] then
    raise exception 'FAIL: 3: unexpected storage policies: %', v_actual;
  end if;
  if exists (select 1 from storage.buckets where public) then
    raise exception 'FAIL: 3: a public storage bucket exists';
  end if;

  -- 4
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'FAIL: 4: anon can execute %', v_bad; end if;

  -- 5
  if has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') then
    raise exception 'FAIL: 5: authenticated can execute rls_auto_enable';
  end if;
end
$$;

-- 5 & 8: new objects (rolled back)
create table public.t212_probe (id int);
create function public.t212_probe_fn() returns int language sql as $$ select 1 $$;
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.t212_probe'::regclass) then
    raise exception 'FAIL: 5: new public table did not get RLS (event trigger broken)';
  end if;
  if has_table_privilege('anon', 'public.t212_probe', 'SELECT') then
    raise exception 'FAIL: 8: anon has default privileges on a new public table';
  end if;
  if has_function_privilege('anon', 'public.t212_probe_fn()', 'EXECUTE') then
    raise exception 'FAIL: 8: anon can execute a new public function by default';
  end if;
  if exists (select 1 from pg_proc, aclexplode(coalesce(proacl, acldefault('f', proowner))) a
             where oid = 'public.t212_probe_fn()'::regprocedure and a.grantee = 0) then
    raise exception 'FAIL: 8: PUBLIC can execute a new function by default';
  end if;
end
$$;

-- 6 & 7 employee
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c121","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.profiles) <> 1 or (select count(*) from public.user_roles) <> 1 then
    raise exception 'FAIL: 6: employee sees other profiles or roles';
  end if;
  begin
    perform public.rls_auto_enable();
    raise exception 'FAIL: 5: authenticated called rls_auto_enable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.audit_list(10, 0, null);
    raise exception 'FAIL: 7: employee read the audit log';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

-- 6 & 7 hr_admin (users.read, not roles.manage)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c122","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.profiles) < 4 then
    raise exception 'FAIL: 6: hr_admin cannot see all profiles';
  end if;
  if exists (select 1 from public.user_roles where user_id <> '00000000-0000-4000-8000-00000000c122') then
    raise exception 'FAIL: 6: hr_admin sees other users'' role rows';
  end if;
  begin
    perform * from public.audit_list(10, 0, null);
    raise exception 'FAIL: 7: hr_admin read the audit log';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You do not have permission%' then raise exception 'FAIL: 7: unexpected: %', sqlerrm; end if;
  end;
end
$$;
reset role;

-- 7 payroll_admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c123","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform * from public.audit_actions();
  raise exception 'FAIL: 7: payroll_admin listed audit actions';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
end
$$;
reset role;

-- 6 & 7 super_admin
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.sa'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.user_roles) < 4 then
    raise exception 'FAIL: 6: super_admin cannot see all role rows';
  end if;
  if (select count(*) from public.audit_list(500, 0, null)) = 0 then
    raise exception 'FAIL: 7: super_admin sees no audit rows';
  end if;
  if (select count(*) from public.audit_list(5, 0, 'role_granted')) = 0
     or exists (select 1 from public.audit_list(50, 0, 'role_granted') where action <> 'role_granted') then
    raise exception 'FAIL: 7: action filter wrong';
  end if;
  if not exists (select 1 from public.audit_actions() where action = 'role_granted') then
    raise exception 'FAIL: 7: audit_actions incomplete';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform * from public.audit_list(1, 0, null);
  raise exception 'FAIL: 7: anon executed audit_list';
exception when insufficient_privilege then null;
end
$$;
reset role;

select 'ALL TESTS PASSED' as result;

rollback;
