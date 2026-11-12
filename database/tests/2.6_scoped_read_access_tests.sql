-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.6 (scoped read access)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK. Failures raise "FAIL: ...";
-- success returns "ALL TESTS PASSED". Fictional @example.test accounts.
--
-- Accounts (all active unless noted)
--   d601 employee       -> NX005 (reports to NX003)
--   d602 manager        -> NX003 (direct reports NX004, NX005, NX006, NX011)
--   d603 hr_admin       -> NX002
--   d604 payroll_admin  -> NX009
--   d605 employee only  -> NX007 (has reports, but no manager role)
--   d606 pending        -> no role
--   super_admin         -> the real bootstrap account (read-only checks)
--
--   1. employee sees only own employees/attendance/leave/training rows
--   2. manager sees self + direct reports only, for all four tables
--   3. manager_id without the manager role grants no team access
--   4. hr_admin sees all employees but no compensation
--   5. payroll_admin reads compensation
--   6. nobody (employee, manager, hr, payroll, super_admin) reads payroll_items
--   7. employees.monthly_ctc does not exist
--   8. announcements filtered by audience and publish window
--   9. inactive courses hidden from employees, visible to HR
--  10. anon cannot read employees; pending user sees nothing
--  11. no direct writes for authenticated; locked tables unreadable
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
    ('00000000-0000-4000-8000-00000000d601', 't26.employee@example.test'),
    ('00000000-0000-4000-8000-00000000d602', 't26.manager@example.test'),
    ('00000000-0000-4000-8000-00000000d603', 't26.hr@example.test'),
    ('00000000-0000-4000-8000-00000000d604', 't26.payroll@example.test'),
    ('00000000-0000-4000-8000-00000000d605', 't26.norole@example.test'),
    ('00000000-0000-4000-8000-00000000d606', 't26.pending@example.test')
  ) as v(id, email);

  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000d601'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000d602'::uuid, 'NX003'),
    ('00000000-0000-4000-8000-00000000d603'::uuid, 'NX002'),
    ('00000000-0000-4000-8000-00000000d604'::uuid, 'NX009'),
    ('00000000-0000-4000-8000-00000000d605'::uuid, 'NX007'));
  if (select count(*) from public.profiles
      where id::text like '00000000-0000-4000-8000-00000000d60%' and employee_id is not null) <> 5 then
    raise exception 'FAIL: setup: could not link test profiles';
  end if;

  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000d601', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000d602', 'manager',       v_sa),
    ('00000000-0000-4000-8000-00000000d602', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000d603', 'hr_admin',      v_sa),
    ('00000000-0000-4000-8000-00000000d604', 'payroll_admin', v_sa),
    ('00000000-0000-4000-8000-00000000d605', 'employee',      v_sa);

  -- Expected sets
  perform set_config('test.nx005', (select id::text from public.employees where employee_code = 'NX005'), true);
  perform set_config('test.nx003', (select id::text from public.employees where employee_code = 'NX003'), true);
  perform set_config('test.nx007', (select id::text from public.employees where employee_code = 'NX007'), true);
  perform set_config('test.emp_count', (select count(*)::text from public.employees), true);
  perform set_config('test.team', (
    select string_agg(id::text, ',' order by id) from public.employees
    where employee_code = 'NX003' or manager_id = (select id from public.employees where employee_code = 'NX003')), true);

  -- Announcements fixture (the two seeded ones are ALL + published)
  insert into public.announcements (title, body, audience, department_id, published_at, expires_at, is_published) values
    ('T26 eng',      'x', 'DEPARTMENT', (select department_id from public.employees where employee_code = 'NX005'), now() - interval '1 hour', null, true),
    ('T26 sales',    'x', 'DEPARTMENT', (select department_id from public.employees where employee_code = 'NX007'), now() - interval '1 hour', null, true),
    ('T26 expired',  'x', 'ALL',        null, now() - interval '2 days', now() - interval '1 day', true),
    ('T26 draft',    'x', 'ALL',        null, null, null, false),
    ('T26 future',   'x', 'ALL',        null, now() + interval '1 day', null, true),
    ('T26 managers', 'x', 'MANAGERS',   null, now() - interval '1 hour', null, true);

  -- One inactive course
  update public.training_courses set is_active = false
  where id = (select id from public.training_courses order by title limit 1);

  if (select department_id from public.employees where employee_code = 'NX005')
     = (select department_id from public.employees where employee_code = 'NX007') then
    raise exception 'FAIL: setup: NX005 and NX007 share a department';
  end if;
end
$$;

-- 7
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employees' and column_name = 'monthly_ctc') then
    raise exception 'FAIL: 7: employees.monthly_ctc exists';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. employee (NX005)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d601","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  me uuid := current_setting('test.nx005')::uuid;
begin
  if (select count(*) from public.employees) <> 1
     or (select id from public.employees) <> me then
    raise exception 'FAIL: 1: employee sees employees other than self';
  end if;
  if exists (select 1 from public.attendance where employee_id <> me)
     or not exists (select 1 from public.attendance where employee_id = me) then
    raise exception 'FAIL: 1: employee attendance scope wrong';
  end if;
  if exists (select 1 from public.leave_requests where employee_id <> me)
     or not exists (select 1 from public.leave_requests where employee_id = me) then
    raise exception 'FAIL: 1: employee leave scope wrong';
  end if;
  if exists (select 1 from public.training_enrollments where employee_id <> me) then
    raise exception 'FAIL: 1: employee training scope wrong';
  end if;
  if (select count(*) from public.employee_compensation) <> 0 then
    raise exception 'FAIL: 1: employee reads compensation';
  end if;
  -- 8: two seeded ALL + own department
  if (select count(*) from public.announcements) <> 3
     or exists (select 1 from public.announcements
                where title in ('T26 sales', 'T26 expired', 'T26 draft', 'T26 future', 'T26 managers')) then
    raise exception 'FAIL: 8: employee announcement filter wrong (% rows)',
      (select count(*) from public.announcements);
  end if;
  -- 9
  if exists (select 1 from public.training_courses where not is_active)
     or (select count(*) from public.training_courses) <> 2 then
    raise exception 'FAIL: 9: employee sees inactive course';
  end if;
  -- 11: no direct writes
  begin
    update public.employees set phone = '1' where id = me;
    raise exception 'FAIL: 11: direct UPDATE on employees allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.attendance where employee_id = me;
    raise exception 'FAIL: 11: direct DELETE on attendance allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, total_days)
    select me, id, current_date, current_date, 1 from public.leave_types limit 1;
    raise exception 'FAIL: 11: direct INSERT on leave_requests allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.audit_logs;
    raise exception 'FAIL: 11: employee can query audit_logs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.employee_documents;
    raise exception 'FAIL: 11: employee can query employee_documents';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.payroll_items;
    raise exception 'FAIL: 6: employee can query payroll_items';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- ---------------------------------------------------------------------
-- 2. manager (NX003)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d602","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  team uuid[] := string_to_array(current_setting('test.team'), ',')::uuid[];
begin
  if (select array_agg(id order by id) from public.employees) is distinct from team then
    raise exception 'FAIL: 2: manager employee scope wrong';
  end if;
  if exists (select 1 from public.attendance where employee_id <> all (team))
     or (select count(distinct employee_id) from public.attendance) < 2 then
    raise exception 'FAIL: 2: manager attendance scope wrong';
  end if;
  if exists (select 1 from public.leave_requests where employee_id <> all (team))
     or (select count(*) from public.leave_requests) < 2 then
    raise exception 'FAIL: 2: manager leave scope wrong';
  end if;
  if exists (select 1 from public.training_enrollments where employee_id <> all (team)) then
    raise exception 'FAIL: 2: manager training scope wrong';
  end if;
  if (select count(*) from public.employee_compensation) <> 0 then
    raise exception 'FAIL: 2: manager reads compensation';
  end if;
  if not exists (select 1 from public.announcements where title = 'T26 managers') then
    raise exception 'FAIL: 8: manager cannot see MANAGERS announcement';
  end if;
  begin
    perform count(*) from public.payroll_items;
    raise exception 'FAIL: 6: manager can query payroll_items';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- ---------------------------------------------------------------------
-- 3. employee-only account that is someone's manager_id (NX007)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d605","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.employees) <> 1
     or exists (select 1 from public.attendance where employee_id <> current_setting('test.nx007')::uuid) then
    raise exception 'FAIL: 3: manager_id without manager role grants team access';
  end if;
  if exists (select 1 from public.announcements where title = 'T26 managers') then
    raise exception 'FAIL: 8: non-manager sees MANAGERS announcement';
  end if;
end
$$;
reset role;

-- ---------------------------------------------------------------------
-- 4. hr_admin
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d603","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.employees) <> current_setting('test.emp_count')::bigint then
    raise exception 'FAIL: 4: hr_admin does not see all employees';
  end if;
  if (select count(*) from public.employee_compensation) <> 0 then
    raise exception 'FAIL: 4: hr_admin reads compensation';
  end if;
  if (select count(*) from public.announcements where title like 'T26 %') <> 6 then
    raise exception 'FAIL: 8: hr_admin does not see all announcements';
  end if;
  if (select count(*) from public.training_courses) <> 3 then
    raise exception 'FAIL: 9: hr_admin does not see inactive course';
  end if;
  begin
    perform count(*) from public.payroll_items;
    raise exception 'FAIL: 6: hr_admin can query payroll_items';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- ---------------------------------------------------------------------
-- 5. payroll_admin
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d604","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.employee_compensation where effective_to is null)
     <> current_setting('test.emp_count')::bigint then
    raise exception 'FAIL: 5: payroll_admin cannot read compensation';
  end if;
  begin
    perform count(*) from public.payroll_items;
    raise exception 'FAIL: 6: payroll_admin can query payroll_items directly';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- ---------------------------------------------------------------------
-- 6. super_admin cannot query payroll_items directly either
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.sa'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform count(*) from public.payroll_items;
  raise exception 'FAIL: 6: super_admin can query payroll_items directly';
exception when insufficient_privilege then null;
end
$$;
reset role;

-- ---------------------------------------------------------------------
-- 10. pending user and anon
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000d606","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.employees) <> 0
     or (select count(*) from public.attendance) <> 0
     or (select count(*) from public.announcements) <> 0
     or (select count(*) from public.training_courses) <> 0 then
    raise exception 'FAIL: 10: pending user can read data';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform count(*) from public.employees;
  raise exception 'FAIL: 10: anon can query employees';
exception when insufficient_privilege then null;
end
$$;
reset role;

select 'ALL TESTS PASSED' as result;

rollback;
