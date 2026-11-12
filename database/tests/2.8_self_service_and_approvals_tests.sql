-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.8 (self-service and approvals)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK. Failures raise "FAIL: ...";
-- success returns "ALL TESTS PASSED". Fictional @example.test accounts.
-- Uses fixed December 2026 dates (seeded 2026 holidays: 25 Dec is a
-- holiday and a Friday).
--
-- Accounts: e801 employee NX005 (manager NX003); e802 manager NX003;
--           e803 hr_admin NX002; e804 employee NX008 (manager NX007);
--           e805 pending (no role).
--
--  1. update_my_phone changes only the caller's phone; bad input rejected
--  2. no direct edits to employees (another's or own other fields)
--  3. check_in/check_out only create/update the caller's row for today;
--     double check-in / check-out rejected
--  4. apply_leave computes total_days excluding weekends and holidays
--  5. overlapping leave rejected
--  6. paid balance cannot be exceeded; invalid ranges rejected
--  7. nobody can decide their own leave (manager, hr_admin)
--  8. manager approves a direct report's leave; approver + note stored
--  9. manager cannot decide leave outside their team
-- 10. hr_admin (employees.manage) can decide any other employee's leave
-- 11. cancel_my_leave: own PENDING only
-- 12. training status: own enrolment only, forward-only
-- 13. balances and profile return the caller's own data
-- 14. pending users and anon cannot use self-service
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
    ('00000000-0000-4000-8000-00000000e801', 't28.employee@example.test'),
    ('00000000-0000-4000-8000-00000000e802', 't28.manager@example.test'),
    ('00000000-0000-4000-8000-00000000e803', 't28.hr@example.test'),
    ('00000000-0000-4000-8000-00000000e804', 't28.other@example.test'),
    ('00000000-0000-4000-8000-00000000e805', 't28.pending@example.test')
  ) as v(id, email);

  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000e801'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000e802'::uuid, 'NX003'),
    ('00000000-0000-4000-8000-00000000e803'::uuid, 'NX002'),
    ('00000000-0000-4000-8000-00000000e804'::uuid, 'NX008'));
  if (select count(*) from public.profiles
      where id::text like '00000000-0000-4000-8000-00000000e80%' and employee_id is not null) <> 4 then
    raise exception 'FAIL: setup: could not link test profiles';
  end if;

  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000e801', 'employee', v_sa),
    ('00000000-0000-4000-8000-00000000e802', 'manager',  v_sa),
    ('00000000-0000-4000-8000-00000000e802', 'employee', v_sa),
    ('00000000-0000-4000-8000-00000000e803', 'hr_admin', v_sa),
    ('00000000-0000-4000-8000-00000000e804', 'employee', v_sa);

  perform set_config('test.nx005', (select id::text from public.employees where employee_code = 'NX005'), true);
  perform set_config('test.nx003', (select id::text from public.employees where employee_code = 'NX003'), true);
  perform set_config('test.nx004', (select id::text from public.employees where employee_code = 'NX004'), true);
  perform set_config('test.nx008', (select id::text from public.employees where employee_code = 'NX008'), true);
  perform set_config('test.cl',  (select id::text from public.leave_types where code = 'CL'), true);
  perform set_config('test.bl',  (select id::text from public.leave_types where code = 'BL'), true);
  perform set_config('test.lwp', (select id::text from public.leave_types where code = 'LWP'), true);
  if current_setting('test.cl', true) is null or current_setting('test.bl', true) is null then
    raise exception 'FAIL: setup: leave types CL/BL missing';
  end if;

  -- One enrolment each for NX005 and NX008 that is still ASSIGNED.
  insert into public.training_enrollments (course_id, employee_id, status)
  select c.id, e.id, 'ASSIGNED'
  from public.training_courses c cross join public.employees e
  where e.employee_code in ('NX005', 'NX008')
    and not exists (select 1 from public.training_enrollments t
                    where t.course_id = c.id and t.employee_id = e.id)
  on conflict do nothing;
  update public.training_enrollments set status = 'ASSIGNED', completed_at = null
  where id in (select distinct on (employee_id) id from public.training_enrollments
               where employee_id in (current_setting('test.nx005')::uuid, current_setting('test.nx008')::uuid)
               order by employee_id, id);
  perform set_config('test.enr5', (select id::text from public.training_enrollments
    where employee_id = current_setting('test.nx005')::uuid and status = 'ASSIGNED' order by id limit 1), true);
  perform set_config('test.enr8', (select id::text from public.training_enrollments
    where employee_id = current_setting('test.nx008')::uuid and status = 'ASSIGNED' order by id limit 1), true);

  -- No attendance today for the test employees.
  delete from public.attendance
  where attendance_date = (now() at time zone 'Asia/Kolkata')::date
    and employee_id in (current_setting('test.nx005')::uuid, current_setting('test.nx008')::uuid);

  perform set_config('test.nx005_row', (
    select (to_jsonb(e) - 'phone' - 'updated_at')::text from public.employees e
    where e.id = current_setting('test.nx005')::uuid), true);
  perform set_config('test.nx004_phone', coalesce((select phone from public.employees
    where id = current_setting('test.nx004')::uuid), '<null>'), true);
  perform set_config('test.att_today_others', (select count(*)::text from public.attendance
    where attendance_date = (now() at time zone 'Asia/Kolkata')::date), true);
end
$$;

-- =====================================================================
-- e801 employee (NX005)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e801","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  me uuid := current_setting('test.nx005')::uuid;
  v_id uuid;
  v_profile jsonb;
  v_before numeric;
begin
  -- 1
  perform public.update_my_phone('+91 98450 12345');
  if (select phone from public.employees where id = me) <> '+91 98450 12345' then
    raise exception 'FAIL: 1: phone not updated';
  end if;
  begin
    perform public.update_my_phone('call me maybe');
    raise exception 'FAIL: 1: invalid phone accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Enter a valid phone number%' then raise exception 'FAIL: 1: unexpected: %', sqlerrm; end if;
  end;

  -- 2
  begin
    update public.employees set designation = 'CEO' where id = me;
    raise exception 'FAIL: 2: employee edited own designation directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.employees set phone = '1' where id = current_setting('test.nx004')::uuid;
    raise exception 'FAIL: 2: employee edited another employee directly';
  exception when insufficient_privilege then null;
  end;

  -- 3
  v_id := public.check_in();
  if (select employee_id from public.attendance where id = v_id) <> me then
    raise exception 'FAIL: 3: check_in row is not the caller''s';
  end if;
  begin
    perform public.check_in();
    raise exception 'FAIL: 3: double check-in accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You have already checked in today%' then raise exception 'FAIL: 3: unexpected: %', sqlerrm; end if;
  end;
  perform public.check_out();
  if (select check_out from public.attendance where id = v_id) is null then
    raise exception 'FAIL: 3: check_out not recorded';
  end if;
  begin
    perform public.check_out();
    raise exception 'FAIL: 3: double check-out accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You have already checked out today%' then raise exception 'FAIL: 3: unexpected: %', sqlerrm; end if;
  end;

  -- 4: Mon 21 – Mon 28 Dec 2026, minus Sat/Sun and Fri 25 (holiday) = 5
  select approved_days into v_before from public.my_leave_balances(2026) where code = 'CL';
  perform set_config('test.cl_before', v_before::text, true);
  v_id := public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-21', date '2026-12-28', 'Year-end break');
  if (select total_days from public.leave_requests where id = v_id) <> 5 then
    raise exception 'FAIL: 4: total_days = %, expected 5', (select total_days from public.leave_requests where id = v_id);
  end if;
  if (select status from public.leave_requests where id = v_id) <> 'PENDING' then
    raise exception 'FAIL: 4: new request is not PENDING';
  end if;
  perform set_config('test.req5', v_id::text, true);

  -- 5
  begin
    perform public.apply_leave(current_setting('test.lwp')::uuid, date '2026-12-24', date '2026-12-24', null);
    raise exception 'FAIL: 5: overlapping leave accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'These dates overlap%' then raise exception 'FAIL: 5: unexpected: %', sqlerrm; end if;
  end;

  -- 6
  begin
    perform public.apply_leave(current_setting('test.bl')::uuid, date '2026-12-07', date '2026-12-11', null);
    raise exception 'FAIL: 6: paid balance exceeded';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Not enough % balance%' then raise exception 'FAIL: 6: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-10', date '2026-12-09', null);
    raise exception 'FAIL: 6: end before start accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-05', date '2026-12-06', null);
    raise exception 'FAIL: 6: weekend-only leave accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'The selected dates contain no working days%' then raise exception 'FAIL: 6: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-30', date '2027-01-02', null);
    raise exception 'FAIL: 6: cross-year leave accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- 12
  perform public.update_my_training_status(current_setting('test.enr5')::uuid, 'IN_PROGRESS');
  perform public.update_my_training_status(current_setting('test.enr5')::uuid, 'COMPLETED');
  if (select completed_at from public.training_enrollments where id = current_setting('test.enr5')::uuid) is null then
    raise exception 'FAIL: 12: completed_at not set';
  end if;
  begin
    perform public.update_my_training_status(current_setting('test.enr5')::uuid, 'IN_PROGRESS');
    raise exception 'FAIL: 12: went back from COMPLETED';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.update_my_training_status(current_setting('test.enr8')::uuid, 'COMPLETED');
    raise exception 'FAIL: 12: updated another employee''s training';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Training enrolment not found%' then raise exception 'FAIL: 12: unexpected: %', sqlerrm; end if;
  end;

  -- 13
  v_profile := public.get_my_profile();
  if v_profile ->> 'employee_code' <> 'NX005' or v_profile ->> 'manager_code' <> 'NX003' then
    raise exception 'FAIL: 13: profile wrong: %', v_profile;
  end if;
end
$$;
reset role;

-- 1 & 3 as owner: nothing else changed
do $$
begin
  if (select (to_jsonb(e) - 'phone' - 'updated_at')::text from public.employees e
      where e.id = current_setting('test.nx005')::uuid) <> current_setting('test.nx005_row') then
    raise exception 'FAIL: 1: update_my_phone changed other fields';
  end if;
  if coalesce((select phone from public.employees where id = current_setting('test.nx004')::uuid), '<null>')
     <> current_setting('test.nx004_phone') then
    raise exception 'FAIL: 1: another employee''s phone changed';
  end if;
  if (select count(*) from public.attendance
      where attendance_date = (now() at time zone 'Asia/Kolkata')::date)
     <> current_setting('test.att_today_others')::bigint + 1 then
    raise exception 'FAIL: 3: check_in created rows for other employees';
  end if;
end
$$;

-- =====================================================================
-- e804 employee NX008 (outside NX003's team)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e804","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid;
begin
  v_id := public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-01', date '2026-12-01', null);
  perform set_config('test.req8', v_id::text, true);
  v_id := public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-02', date '2026-12-02', null);
  perform set_config('test.req8b', v_id::text, true);

  -- 11: cannot cancel someone else's
  begin
    perform public.cancel_my_leave(current_setting('test.req5')::uuid);
    raise exception 'FAIL: 11: cancelled another employee''s leave';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Leave request not found%' then raise exception 'FAIL: 11: unexpected: %', sqlerrm; end if;
  end;
  perform public.cancel_my_leave(current_setting('test.req8b')::uuid);
  if (select status from public.leave_requests where id = current_setting('test.req8b')::uuid) <> 'CANCELLED' then
    raise exception 'FAIL: 11: own pending leave not cancelled';
  end if;
end
$$;
reset role;

-- =====================================================================
-- e802 manager NX003
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e802","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_own uuid;
begin
  -- 7: own request
  v_own := public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-14', date '2026-12-14', null);
  perform set_config('test.req3', v_own::text, true);
  begin
    perform public.decide_leave(v_own, true, null);
    raise exception 'FAIL: 7: manager approved own leave';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You cannot decide your own leave request%' then raise exception 'FAIL: 7: unexpected: %', sqlerrm; end if;
  end;

  -- 9: outside the team
  begin
    perform public.decide_leave(current_setting('test.req8')::uuid, true, null);
    raise exception 'FAIL: 9: manager decided leave outside the team';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Leave request not found%' then raise exception 'FAIL: 9: unexpected: %', sqlerrm; end if;
  end;

  -- 8: direct report
  perform public.decide_leave(current_setting('test.req5')::uuid, true, 'Enjoy the break');
end
$$;
reset role;

do $$
declare r public.leave_requests%rowtype;
begin
  select * into r from public.leave_requests where id = current_setting('test.req5')::uuid;
  if r.status <> 'APPROVED' or r.approver_id <> current_setting('test.nx003')::uuid
     or r.decision_note <> 'Enjoy the break' or r.decided_at is null then
    raise exception 'FAIL: 8: approval not stored correctly';
  end if;
  if (select status from public.leave_requests where id = current_setting('test.req8')::uuid) <> 'PENDING' then
    raise exception 'FAIL: 9: out-of-team request changed';
  end if;
end
$$;

-- =====================================================================
-- e801 again: cancel approved rejected; balance updated
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e801","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.cancel_my_leave(current_setting('test.req5')::uuid);
    raise exception 'FAIL: 11: approved leave cancelled';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Only pending leave requests can be cancelled%' then raise exception 'FAIL: 11: unexpected: %', sqlerrm; end if;
  end;
  if (select approved_days from public.my_leave_balances(2026) where code = 'CL')
     <> current_setting('test.cl_before')::numeric + 5
     or (select balance from public.my_leave_balances(2026) where code = 'CL')
     <> (select annual_allowance from public.leave_types where code = 'CL') - current_setting('test.cl_before')::numeric - 5 then
    raise exception 'FAIL: 13: balance not allowance minus approved days';
  end if;
end
$$;
reset role;

-- =====================================================================
-- e803 hr_admin NX002
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e803","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_own uuid;
begin
  -- 10
  perform public.decide_leave(current_setting('test.req3')::uuid, false, 'Project deadline');
  perform public.decide_leave(current_setting('test.req8')::uuid, true, null);
  -- 7: hr_admin's own
  v_own := public.apply_leave(current_setting('test.cl')::uuid, date '2026-12-15', date '2026-12-15', null);
  begin
    perform public.decide_leave(v_own, true, null);
    raise exception 'FAIL: 7: hr_admin approved own leave';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You cannot decide your own leave request%' then raise exception 'FAIL: 7: unexpected: %', sqlerrm; end if;
  end;
end
$$;
reset role;

do $$
begin
  if (select status || '|' || coalesce(decision_note, '') from public.leave_requests
      where id = current_setting('test.req3')::uuid) <> 'REJECTED|Project deadline' then
    raise exception 'FAIL: 10: hr_admin rejection not stored';
  end if;
  if (select status from public.leave_requests where id = current_setting('test.req8')::uuid) <> 'APPROVED' then
    raise exception 'FAIL: 10: hr_admin approval not stored';
  end if;
  if (select count(*) from public.audit_logs
      where action in ('leave_applied', 'leave_decided', 'leave_cancelled', 'attendance_check_in',
                       'attendance_check_out', 'employee_phone_updated', 'training_status_updated')
        and created_at >= now() - interval '1 minute') < 10 then
    raise exception 'FAIL: audit rows missing';
  end if;
end
$$;

-- =====================================================================
-- 14. pending user and anon
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e805","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.check_in();
    raise exception 'FAIL: 14: pending user checked in';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Your account is not linked to an active employee record%' then raise exception 'FAIL: 14: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.decide_leave(current_setting('test.req5')::uuid, false, null);
    raise exception 'FAIL: 14: pending user decided leave';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform public.check_in();
  raise exception 'FAIL: 14: anon executed check_in';
exception when insufficient_privilege then null;
end
$$;
reset role;

select 'ALL TESTS PASSED' as result;

rollback;
