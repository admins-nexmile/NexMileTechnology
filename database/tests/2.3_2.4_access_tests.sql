-- =====================================================================
-- Nexmile HRMS — Access tests for migrations 2.3 and 2.4
-- =====================================================================
-- Run in the Supabase SQL Editor AFTER applying 2.3 and 2.4.
--
-- SAFE: everything runs inside one transaction that ends in ROLLBACK.
-- The temporary test users, employee email changes, invitations and audit
-- rows it creates are all discarded. Nothing persists.
--
-- How results are reported
--   * Any failed expectation raises an exception starting with "FAIL:"
--     and the whole script stops (and rolls back).
--   * If every test passes, the last query returns one row:
--     "ALL TESTS PASSED". (PASS notices also appear in the Messages log
--     where the client shows them.)
--
-- Users are simulated the way PostgREST does it: SET ROLE authenticated
-- plus request.jwt.claims containing the user id ("sub").
--
-- Tests
--   1. hr_admin cannot invite payroll_admin.
--   2. Nobody (hr_admin or super_admin) can invite super_admin.
--   3. Email / employee work_email mismatch is rejected.
--   4. An accepted invitation cannot be reused (second accept -> 'none',
--      another user -> 'none', re-inviting the linked employee rejected).
--   5. A pending user cannot read departments; an active user can.
--
-- Requirements: a super_admin exists, and at least two employees with
-- employment_status ACTIVE / ON_LEAVE / NOTICE_PERIOD that are not linked to a
-- profile (the synthetic demo data satisfies this).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Setup (as the database owner)
-- ---------------------------------------------------------------------
do $$
declare
  v_sa   uuid;
  v_e1   uuid;
  v_e2   uuid;
  v_dept bigint;
begin
  select ur.user_id into v_sa
  from public.user_roles ur where ur.role_key = 'super_admin' limit 1;
  if v_sa is null then
    raise exception 'FAIL: setup: no super_admin found';
  end if;

  -- Temporary verified users (the 2.1 trigger creates pending profiles).
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-4000-8000-00000000a001', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'test.hr@nexmiletechnology.com', now(),
     '{"provider":"google"}', '{"full_name":"Test HR"}', now(), now()),
    ('00000000-0000-4000-8000-00000000a002', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'test.invitee@nexmiletechnology.com', now(),
     '{"provider":"google"}', '{"full_name":"Test Invitee"}', now(), now()),
    ('00000000-0000-4000-8000-00000000a003', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'test.pending@nexmiletechnology.com', now(),
     '{"provider":"google"}', '{"full_name":"Test Pending"}', now(), now());

  -- Make test.hr an active hr_admin.
  update public.profiles set status = 'active'
  where id = '00000000-0000-4000-8000-00000000a001';
  insert into public.user_roles (user_id, role_key, granted_by)
  values ('00000000-0000-4000-8000-00000000a001', 'hr_admin', v_sa);

  -- Two eligible, unlinked employees without an open invitation.
  select e.id into v_e1
  from public.employees e
  where app_private.employee_status_invitable(e.employment_status::text)
    and not exists (select 1 from public.profiles p where p.employee_id = e.id)
    and not exists (select 1 from public.invitations i
                    where i.employee_id = e.id and i.status = 'pending')
  order by e.id limit 1;

  select e.id into v_e2
  from public.employees e
  where app_private.employee_status_invitable(e.employment_status::text)
    and e.id <> v_e1
    and not exists (select 1 from public.profiles p where p.employee_id = e.id)
    and not exists (select 1 from public.invitations i
                    where i.employee_id = e.id and i.status = 'pending')
  order by e.id limit 1;

  if v_e1 is null or v_e2 is null then
    raise exception 'FAIL: setup: need two eligible, unlinked employees';
  end if;

  -- Point their work emails at the test addresses (rolled back at the end).
  update public.employees set work_email = 'test.invitee@nexmiletechnology.com' where id = v_e1;
  update public.employees set work_email = 'test.other@nexmiletechnology.com'   where id = v_e2;

  select count(*) into v_dept from public.departments;

  perform set_config('test.sa',         v_sa::text,   true);
  perform set_config('test.e1',         v_e1::text,   true);
  perform set_config('test.e2',         v_e2::text,   true);
  perform set_config('test.dept_count', v_dept::text, true);
end
$$;

-- ---------------------------------------------------------------------
-- Tests 1-3 as test.hr (hr_admin)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;

-- 1. hr_admin cannot invite payroll_admin
do $$
begin
  perform public.create_invitation('test.invitee@nexmiletechnology.com', 'payroll_admin',
                                   current_setting('test.e1')::uuid);
  raise exception 'FAIL: 1: hr_admin was able to invite payroll_admin';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'You are not allowed to invite%' then
    raise exception 'FAIL: 1: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 1: hr_admin cannot invite payroll_admin (%)', sqlerrm;
end
$$;

-- 2a. hr_admin cannot invite super_admin
do $$
begin
  perform public.create_invitation('test.invitee@nexmiletechnology.com', 'super_admin',
                                   current_setting('test.e1')::uuid);
  raise exception 'FAIL: 2a: hr_admin was able to invite super_admin';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'The Super Admin role cannot be granted%' then
    raise exception 'FAIL: 2a: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 2a: hr_admin cannot invite super_admin';
end
$$;

-- 3a. invited email differs from the employee's work_email
do $$
begin
  perform public.create_invitation('test.other@nexmiletechnology.com', 'employee',
                                   current_setting('test.e1')::uuid);
  raise exception 'FAIL: 3a: mismatched email was accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'The email does not match%' then
    raise exception 'FAIL: 3a: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 3a: email/employee mismatch rejected';
end
$$;

-- 3b. right email, wrong employee
do $$
begin
  perform public.create_invitation('test.invitee@nexmiletechnology.com', 'employee',
                                   current_setting('test.e2')::uuid);
  raise exception 'FAIL: 3b: wrong employee was accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'The email does not match%' then
    raise exception 'FAIL: 3b: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 3b: employee/email mismatch rejected';
end
$$;

-- 4 (setup). valid invitation: hr_admin invites the employee role
do $$
declare v_id uuid;
begin
  v_id := public.create_invitation('test.invitee@nexmiletechnology.com', 'employee',
                                   current_setting('test.e1')::uuid);
  if v_id is null then
    raise exception 'FAIL: 4: valid invitation was not created';
  end if;
  perform set_config('test.inv', v_id::text, true);
  raise notice 'PASS 4-setup: valid invitation created';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 2b. super_admin cannot invite super_admin either
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.sa'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
begin
  perform public.create_invitation('test.other@nexmiletechnology.com', 'super_admin',
                                   current_setting('test.e2')::uuid);
  raise exception 'FAIL: 2b: super_admin was able to invite super_admin';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'The Super Admin role cannot be granted%' then
    raise exception 'FAIL: 2b: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 2b: super_admin cannot invite super_admin';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 5a. pending user cannot read departments (before anything else)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_seen bigint;
begin
  select count(*) into v_seen from public.departments;
  if v_seen <> 0 then
    raise exception 'FAIL: 5a: pending user can read % departments', v_seen;
  end if;
  if current_setting('test.dept_count')::bigint = 0 then
    raise notice 'WARN 5a: departments is empty, so this test proves little';
  end if;
  raise notice 'PASS 5a: pending user sees 0 of % departments',
    current_setting('test.dept_count');
end
$$;

-- 4a. a user with no invitation gets 'none'
do $$
begin
  if public.accept_my_invitation() <> 'none' then
    raise exception 'FAIL: 4a: uninvited user did not get none';
  end if;
  raise notice 'PASS 4a: uninvited user -> none';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 4b-4c. invitee accepts once; reuse returns 'none'
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_result text;
begin
  v_result := public.accept_my_invitation();
  if v_result <> 'accepted' then
    raise exception 'FAIL: 4b: first accept returned %', v_result;
  end if;
  raise notice 'PASS 4b: first accept -> accepted';

  v_result := public.accept_my_invitation();
  if v_result <> 'none' then
    raise exception 'FAIL: 4c: second accept returned %', v_result;
  end if;
  raise notice 'PASS 4c: second accept -> none (cannot reuse)';
end
$$;

-- 5b. positive control: the now-active invitee can read departments
do $$
declare v_seen bigint;
begin
  select count(*) into v_seen from public.departments;
  if v_seen <> current_setting('test.dept_count')::bigint then
    raise exception 'FAIL: 5b: active user sees % of % departments',
      v_seen, current_setting('test.dept_count');
  end if;
  raise notice 'PASS 5b: active user sees all % departments', v_seen;
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 4d. hr_admin cannot re-invite the now-linked employee
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform public.create_invitation('test.invitee@nexmiletechnology.com', 'employee',
                                   current_setting('test.e1')::uuid);
  raise exception 'FAIL: 4d: linked employee was re-invited';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'This employee is already linked%' then
    raise exception 'FAIL: 4d: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 4d: linked employee cannot be re-invited';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- Final state checks (as owner) and summary
-- ---------------------------------------------------------------------
do $$
declare v_status text; v_by uuid;
begin
  select status, accepted_by into v_status, v_by
  from public.invitations where id = current_setting('test.inv')::uuid;
  if v_status <> 'accepted' or v_by <> '00000000-0000-4000-8000-00000000a002' then
    raise exception 'FAIL: final: invitation status % accepted_by %', v_status, v_by;
  end if;

  if not exists (select 1 from public.user_roles
                 where user_id = '00000000-0000-4000-8000-00000000a002'
                   and role_key = 'employee'
                   and granted_by = '00000000-0000-4000-8000-00000000a001') then
    raise exception 'FAIL: final: employee role not granted with granted_by = inviter';
  end if;

  if (select employee_id from public.profiles
      where id = '00000000-0000-4000-8000-00000000a002')
     is distinct from current_setting('test.e1')::uuid then
    raise exception 'FAIL: final: profile not linked to the employee';
  end if;
end
$$;

select 'ALL TESTS PASSED' as result;

rollback;
