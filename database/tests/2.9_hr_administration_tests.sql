-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.9 (HR administration)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK. Failures raise "FAIL: ...";
-- success returns "ALL TESTS PASSED". Fictional @example.test accounts.
--
-- Accounts: f901 employee NX005; f902 manager NX003; f903 hr_admin NX002;
--           f904 payroll_admin NX009; f905 super_admin (test) NX001;
--           f906 employee NX008 (target of role / status changes).
--
--  A. employee, manager and payroll_admin cannot call admin functions
--  B. hr_admin: create / update employees; salary and unknown fields
--     rejected; never own record; manager self / cycle rejected;
--     department and status; reference data; announcements; courses
--     and enrolments; user list
--  C. hr_admin role limits: only manager/employee, only on plain accounts,
--     never own roles, cannot suspend
--  D. super_admin: any role, suspend / reactivate, never self; the
--     last-super-admin guard still holds
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
    ('00000000-0000-4000-8000-00000000f901', 't29.employee@example.test'),
    ('00000000-0000-4000-8000-00000000f902', 't29.manager@example.test'),
    ('00000000-0000-4000-8000-00000000f903', 't29.hr@example.test'),
    ('00000000-0000-4000-8000-00000000f904', 't29.payroll@example.test'),
    ('00000000-0000-4000-8000-00000000f905', 't29.super@example.test'),
    ('00000000-0000-4000-8000-00000000f906', 't29.target@example.test')
  ) as v(id, email);

  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000f901'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000f902'::uuid, 'NX003'),
    ('00000000-0000-4000-8000-00000000f903'::uuid, 'NX002'),
    ('00000000-0000-4000-8000-00000000f904'::uuid, 'NX009'),
    ('00000000-0000-4000-8000-00000000f905'::uuid, 'NX001'),
    ('00000000-0000-4000-8000-00000000f906'::uuid, 'NX008'));
  if (select count(*) from public.profiles
      where id::text like '00000000-0000-4000-8000-00000000f90%' and employee_id is not null) <> 6 then
    raise exception 'FAIL: setup: could not link test profiles';
  end if;

  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000f901', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000f902', 'manager',       v_sa),
    ('00000000-0000-4000-8000-00000000f903', 'hr_admin',      v_sa),
    ('00000000-0000-4000-8000-00000000f904', 'payroll_admin', v_sa),
    ('00000000-0000-4000-8000-00000000f905', 'super_admin',   v_sa),
    ('00000000-0000-4000-8000-00000000f906', 'employee',      v_sa);

  perform set_config('test.nx002', (select id::text from public.employees where employee_code = 'NX002'), true);
  perform set_config('test.nx003', (select id::text from public.employees where employee_code = 'NX003'), true);
  perform set_config('test.eng',   (select department_id::text from public.employees where employee_code = 'NX003'), true);
  perform set_config('test.sales', (select department_id::text from public.employees where employee_code = 'NX007'), true);
end
$$;

-- =====================================================================
-- A. Non-admins
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f901","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.admin_create_employee('{"employee_code":"T999","first_name":"X","last_name":"Y","work_email":"x@example.test","designation":"D","hire_date":"2026-01-01"}');
    raise exception 'FAIL: A: employee created an employee';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You do not have permission%' then raise exception 'FAIL: A: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_save_department(null, 'Hackers', null);
    raise exception 'FAIL: A: employee created a department';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_save_holiday(null, 'Free day', date '2026-12-01', null, null);
    raise exception 'FAIL: A: employee created a holiday';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'manager', true);
    raise exception 'FAIL: A: employee granted a role';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f901', 'super_admin', true);
    raise exception 'FAIL: A: employee granted themselves super_admin';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform * from public.admin_list_users();
    raise exception 'FAIL: A: employee listed users';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f902","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.admin_set_manager(current_setting('test.nx003')::uuid, null);
    raise exception 'FAIL: A: manager changed the org chart';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_enroll((select id from public.training_courses limit 1), current_setting('test.nx003')::uuid);
    raise exception 'FAIL: A: manager enrolled someone';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f904","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.admin_save_announcement(null, '{"title":"x","body":"y"}');
  raise exception 'FAIL: A: payroll_admin created an announcement';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'You do not have permission%' then raise exception 'FAIL: A: unexpected: %', sqlerrm; end if;
end
$$;
reset role;

-- =====================================================================
-- B & C. hr_admin (NX002)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f903","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_emp uuid;
  v_id uuid;
  v_course uuid;
  v_enr uuid;
  n int;
begin
  -- create
  v_emp := public.admin_create_employee(jsonb_build_object(
    'employee_code', 'T900', 'first_name', 'Test', 'last_name', 'Person',
    'work_email', 'T900@Example.test', 'designation', 'Analyst', 'hire_date', '2026-11-01',
    'department_id', current_setting('test.eng'), 'manager_id', current_setting('test.nx003')));
  if (select work_email from public.employees where id = v_emp) <> 't900@example.test' then
    raise exception 'FAIL: B: employee not created / email not normalised';
  end if;
  perform set_config('test.t900', v_emp::text, true);

  -- salary / unknown fields
  begin
    perform public.admin_create_employee('{"employee_code":"T901","first_name":"A","last_name":"B","work_email":"t901@example.test","designation":"D","hire_date":"2026-01-01","monthly_ctc":50000}');
    raise exception 'FAIL: B: salary field accepted on create';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Unknown or not allowed field: monthly_ctc%' then raise exception 'FAIL: B: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_update_employee(v_emp, '{"manager_id":null}');
    raise exception 'FAIL: B: manager changed through update';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Unknown or not allowed field%' then raise exception 'FAIL: B: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_create_employee('{"employee_code":"T900","first_name":"A","last_name":"B","work_email":"other@example.test","designation":"D","hire_date":"2026-01-01"}');
    raise exception 'FAIL: B: duplicate code accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- update
  perform public.admin_update_employee(v_emp, '{"designation":"Senior Analyst","phone":"+91 90000 00000"}');
  if (select designation from public.employees where id = v_emp) <> 'Senior Analyst' then
    raise exception 'FAIL: B: update not applied';
  end if;

  -- never own record
  begin
    perform public.admin_update_employee(current_setting('test.nx002')::uuid, '{"designation":"CEO"}');
    raise exception 'FAIL: B: hr_admin edited own record';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You cannot change your own employee record%' then raise exception 'FAIL: B: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_set_employment_status(current_setting('test.nx002')::uuid, 'INACTIVE');
    raise exception 'FAIL: B: hr_admin changed own status';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- manager: self and cycle
  begin
    perform public.admin_set_manager(v_emp, v_emp);
    raise exception 'FAIL: B: self-manager accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'An employee cannot be their own manager%' then raise exception 'FAIL: B: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_set_manager(current_setting('test.nx003')::uuid, v_emp);
    raise exception 'FAIL: B: reporting cycle accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'That manager would create a reporting cycle%' then raise exception 'FAIL: B: unexpected: %', sqlerrm; end if;
  end;

  -- department and status
  perform public.admin_set_department(v_emp, current_setting('test.sales')::uuid);
  begin
    perform public.admin_set_employment_status(v_emp, 'RETIRED');
    raise exception 'FAIL: B: invalid status accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  perform public.admin_set_employment_status(v_emp, 'NOTICE_PERIOD');
  if (select department_id::text || employment_status from public.employees where id = v_emp)
     <> current_setting('test.sales') || 'NOTICE_PERIOD' then
    raise exception 'FAIL: B: department / status not applied';
  end if;

  -- reference data
  perform public.admin_save_department(null, 'T9 Department', 'Test');
  begin
    perform public.admin_save_department(null, 't9 department', null);
    raise exception 'FAIL: B: duplicate department accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  perform public.admin_save_leave_type(null, '{"name":"T9 Leave","code":"TNL","annual_allowance":2.5,"is_paid":true}');
  begin
    perform public.admin_save_leave_type(null, '{"name":"Bad","code":"bad1","annual_allowance":1}');
    raise exception 'FAIL: B: bad leave code accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  v_id := public.admin_save_holiday(null, 'T9 Holiday', date '2026-12-04', null, null);
  perform public.admin_delete_holiday(v_id);
  if exists (select 1 from public.holidays where id = v_id) then
    raise exception 'FAIL: B: holiday not deleted';
  end if;

  -- announcements
  begin
    perform public.admin_save_announcement(null, '{"title":"Dept","body":"x","audience":"DEPARTMENT"}');
    raise exception 'FAIL: B: department announcement without department accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  v_id := public.admin_save_announcement(null, '{"title":"T9 Hello","body":"World","audience":"ALL","is_published":true}');
  if (select published_at from public.announcements where id = v_id) is null then
    raise exception 'FAIL: B: published announcement has no published_at';
  end if;

  -- courses and enrolments
  v_course := public.admin_save_course(null, '{"title":"T9 Course","duration_hours":"1.5","is_mandatory":true}');
  v_enr := public.admin_enroll(v_course, v_emp);
  begin
    perform public.admin_enroll(v_course, v_emp);
    raise exception 'FAIL: B: duplicate enrolment accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  perform public.admin_cancel_enrollment(v_enr);
  if public.admin_enroll(v_course, v_emp) <> v_enr then
    raise exception 'FAIL: B: re-enrolment did not reuse the cancelled enrolment';
  end if;

  -- user list
  select count(*) into n from public.admin_list_users() u
  where u.user_id = '00000000-0000-4000-8000-00000000f906' and 'employee' = any (u.roles);
  if n <> 1 then
    raise exception 'FAIL: B: admin_list_users missing target account';
  end if;

  -- C. role limits
  perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'manager', true);
  -- Verified through admin_list_users(): RLS on user_roles (2.1) correctly
  -- hides other users' role rows from hr_admin (no roles.manage).
  if not exists (select 1 from public.admin_list_users() u
                 where u.user_id = '00000000-0000-4000-8000-00000000f906'
                   and 'manager' = any (u.roles)) then
    raise exception 'FAIL: C: hr_admin could not grant manager';
  end if;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'payroll_admin', true);
    raise exception 'FAIL: C: hr_admin granted payroll_admin';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You are not allowed to change the payroll_admin role%' then raise exception 'FAIL: C: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'super_admin', true);
    raise exception 'FAIL: C: hr_admin granted super_admin';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'hr_admin', true);
    raise exception 'FAIL: C: hr_admin granted hr_admin';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f904', 'employee', true);
    raise exception 'FAIL: C: hr_admin changed roles of a payroll_admin account';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f903', 'manager', true);
    raise exception 'FAIL: C: hr_admin changed own roles';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You cannot change your own roles%' then raise exception 'FAIL: C: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_set_user_status('00000000-0000-4000-8000-00000000f906', 'suspended');
    raise exception 'FAIL: C: hr_admin suspended a user';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

-- =====================================================================
-- D. super_admin (test account f905)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000f905","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'payroll_admin', true);
  if not exists (select 1 from public.user_roles
                 where user_id = '00000000-0000-4000-8000-00000000f906' and role_key = 'payroll_admin') then
    raise exception 'FAIL: D: super_admin could not grant payroll_admin';
  end if;
  perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f906', 'payroll_admin', false);

  perform public.admin_set_user_status('00000000-0000-4000-8000-00000000f906', 'suspended');
  if (select status from public.profiles where id = '00000000-0000-4000-8000-00000000f906') <> 'suspended' then
    raise exception 'FAIL: D: suspend not applied';
  end if;
  perform public.admin_set_user_status('00000000-0000-4000-8000-00000000f906', 'active');

  begin
    perform public.admin_set_user_role('00000000-0000-4000-8000-00000000f905', 'super_admin', false);
    raise exception 'FAIL: D: super_admin changed own roles';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_set_user_status('00000000-0000-4000-8000-00000000f905', 'suspended');
    raise exception 'FAIL: D: super_admin suspended self';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- Leaves f905 as the only active super_admin (rolled back at the end).
  perform public.admin_set_user_role(current_setting('test.sa')::uuid, 'super_admin', false);
end
$$;
reset role;

-- Guard: the last active super_admin cannot be removed or suspended.
do $$
begin
  begin
    delete from public.user_roles
    where user_id = '00000000-0000-4000-8000-00000000f905' and role_key = 'super_admin';
    raise exception 'FAIL: D: last super_admin role removed';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Cannot remove the last active super_admin%' then raise exception 'FAIL: D: unexpected: %', sqlerrm; end if;
  end;
  begin
    update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-00000000f905';
    raise exception 'FAIL: D: last super_admin suspended';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  if (select count(*) from public.audit_logs
      where action in ('employee_created', 'employee_updated', 'employee_department_set',
                       'employee_status_set', 'department_created', 'leave_type_created',
                       'holiday_created', 'holiday_deleted', 'announcement_created',
                       'course_created', 'training_enrolled', 'training_enrollment_cancelled',
                       'user_status_set', 'role_granted', 'role_revoked')
        and created_at >= now() - interval '1 minute') < 15 then
    raise exception 'FAIL: audit rows missing';
  end if;
end
$$;

select 'ALL TESTS PASSED' as result;

rollback;
