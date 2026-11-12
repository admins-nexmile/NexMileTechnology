-- =====================================================================
-- Nexmile HRMS — Migration 2.8: employee self-service and leave approvals
-- =====================================================================
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_8_self_service_and_approvals);
--         tests ALL TESTS PASSED.
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.6 applied.
-- Rollback: database/migrations/2.8_self_service_and_approvals.rollback.sql
-- Test:     database/tests/2.8_self_service_and_approvals_tests.sql
--
-- Applied through Supabase MCP apply_migration (one transaction).
--
-- Write functions (app_private SECURITY DEFINER, empty search_path,
-- audited; public SECURITY INVOKER wrappers for authenticated only):
--   update_my_phone(phone)                 own phone only
--   check_in() / check_out()               own row, today (Asia/Kolkata)
--   apply_leave(type, start, end, reason)  active type; same calendar
--       year; no overlap with own PENDING/APPROVED leave; total_days
--       computed here (weekdays minus holidays); paid types cannot exceed
--       allowance − approved − pending days for that year
--   cancel_my_leave(id)                    own PENDING requests only
--   decide_leave(id, approve, note)        direct manager (manager role)
--       or employees.manage; never your own request; balance and overlap
--       re-checked on approval; decision note stored
--   update_my_training_status(id, status)  own enrolment, IN_PROGRESS or
--       COMPLETED (no going back from COMPLETED, none on CANCELLED)
--
-- Read functions (own data only):
--   get_my_profile()       own employee record + department and manager
--                          names (the manager row itself stays hidden)
--   my_leave_balances(yr)  allowance − APPROVED days per active type
--
-- Also: index on leave_requests(leave_type_id) (advisor: unindexed FK).
--
-- Leave balance definition: annual_allowance minus APPROVED total_days of
-- that type whose start_date falls in the calendar year.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.my_employee_id()') is null then
    raise exception '2.8 aborted: migration 2.6 not found';
  end if;
  if to_regprocedure('app_private.apply_leave(uuid,date,date,text)') is not null then
    raise exception '2.8 aborted: 2.8 objects already exist';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.attendance'::regclass and contype = 'u'
                   and pg_get_constraintdef(oid) = 'UNIQUE (employee_id, attendance_date)') then
    raise exception '2.8 aborted: attendance (employee_id, attendance_date) unique constraint missing';
  end if;
  if exists (select 1 from pg_indexes where schemaname = 'public'
             and indexname = 'leave_requests_leave_type_id_idx') then
    raise exception '2.8 aborted: leave_requests_leave_type_id_idx already exists';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Private helpers (no API role may execute)
-- ---------------------------------------------------------------------
-- Today's date in India.
create function app_private.today_ist()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Kolkata')::date; $$;

-- Requires an active, linked employee; returns its id.
create function app_private.require_my_employee()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := app_private.my_employee_id();
begin
  if v_id is null then
    raise exception 'Your account is not linked to an active employee record.'
      using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- Working days in [p_start, p_end] for an employee: Mon–Fri, minus
-- holidays for India or the employee's work location.
create function app_private.count_leave_days(p_employee_id uuid, p_start date, p_end date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::numeric
  from pg_catalog.generate_series(p_start, p_end, interval '1 day') as g(d)
  where extract(isodow from g.d) < 6
    and not exists (
      select 1
      from public.holidays h
      where h.holiday_date = g.d::date
        and (h.location is null
             or h.location = 'India'
             or h.location = (select e.work_location from public.employees e
                              where e.id = p_employee_id))
    );
$$;

-- Days of a leave type in a calendar year with the given statuses.
create function app_private.leave_days_used(
  p_employee_id uuid, p_leave_type_id uuid, p_year integer, p_statuses text[])
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(lr.total_days), 0)
  from public.leave_requests lr
  where lr.employee_id = p_employee_id
    and lr.leave_type_id = p_leave_type_id
    and extract(year from lr.start_date) = p_year
    and lr.status = any (p_statuses);
$$;

-- ---------------------------------------------------------------------
-- 2. Profile
-- ---------------------------------------------------------------------
create function app_private.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me     uuid := app_private.require_my_employee();
  v_result jsonb;
begin
  select pg_catalog.jsonb_build_object(
           'id', e.id,
           'employee_code', e.employee_code,
           'full_name', app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
           'first_name', e.first_name,
           'work_email', e.work_email,
           'phone', e.phone,
           'designation', e.designation,
           'department', d.name,
           'manager_name', app_private.employee_full_name(m.first_name, m.middle_name, m.last_name),
           'manager_code', m.employee_code,
           'hire_date', e.hire_date,
           'work_location', e.work_location,
           'employment_type', e.employment_type,
           'employment_status', e.employment_status)
    into v_result
  from public.employees e
  left join public.departments d on d.id = e.department_id
  left join public.employees m on m.id = e.manager_id
  where e.id = v_me;
  return v_result;
end;
$$;

create function app_private.update_my_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := app_private.require_my_employee();
  v_phone text := nullif(pg_catalog.btrim(p_phone), '');
  v_old   text;
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9 -]{6,18}[0-9]$' then
    raise exception 'Enter a valid phone number (digits, spaces or dashes, optional leading +).';
  end if;

  select phone into v_old from public.employees where id = v_me for update;
  update public.employees set phone = v_phone, updated_at = now() where id = v_me;

  perform app_private.write_audit('employee_phone_updated', 'employee', v_me,
    pg_catalog.jsonb_build_object('changed', v_old is distinct from v_phone));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Attendance
-- ---------------------------------------------------------------------
create function app_private.check_in()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := app_private.require_my_employee();
  v_today  date := app_private.today_ist();
  v_status text;
  v_row    public.attendance%rowtype;
  v_id     uuid;
begin
  select employment_status into v_status from public.employees where id = v_me;
  if v_status = 'INACTIVE' then
    raise exception 'Inactive employees cannot check in.' using errcode = '42501';
  end if;

  select * into v_row from public.attendance
  where employee_id = v_me and attendance_date = v_today
  for update;

  if found then
    if v_row.check_in is not null then
      raise exception 'You have already checked in today.';
    end if;
    update public.attendance
       set check_in = now(), status = 'PRESENT'
     where id = v_row.id
    returning id into v_id;
  else
    insert into public.attendance (employee_id, attendance_date, check_in, status)
    values (v_me, v_today, now(), 'PRESENT')
    returning id into v_id;
  end if;

  perform app_private.write_audit('attendance_check_in', 'attendance', v_id,
    pg_catalog.jsonb_build_object('employee_id', v_me, 'date', v_today));
  return v_id;
end;
$$;

create function app_private.check_out()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := app_private.require_my_employee();
  v_today date := app_private.today_ist();
  v_row   public.attendance%rowtype;
begin
  select * into v_row from public.attendance
  where employee_id = v_me and attendance_date = v_today
  for update;

  if not found or v_row.check_in is null then
    raise exception 'You have not checked in today.';
  end if;
  if v_row.check_out is not null then
    raise exception 'You have already checked out today.';
  end if;

  update public.attendance
     set check_out = now(),
         work_minutes = greatest(0, floor(extract(epoch from (now() - v_row.check_in)) / 60))::integer
   where id = v_row.id;

  perform app_private.write_audit('attendance_check_out', 'attendance', v_row.id,
    pg_catalog.jsonb_build_object('employee_id', v_me, 'date', v_today));
  return v_row.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Leave
-- ---------------------------------------------------------------------
create function app_private.my_leave_balances(p_year integer default null)
returns table (
  leave_type_id uuid, code text, name text, is_paid boolean,
  annual_allowance numeric, approved_days numeric, pending_days numeric, balance numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me   uuid := app_private.require_my_employee();
  v_year integer := coalesce(p_year, extract(year from app_private.today_ist())::integer);
begin
  return query
  select lt.id, lt.code, lt.name, lt.is_paid, lt.annual_allowance,
         app_private.leave_days_used(v_me, lt.id, v_year, array['APPROVED']),
         app_private.leave_days_used(v_me, lt.id, v_year, array['PENDING']),
         lt.annual_allowance - app_private.leave_days_used(v_me, lt.id, v_year, array['APPROVED'])
  from public.leave_types lt
  where lt.is_active
  order by lt.is_paid desc, lt.name;
end;
$$;

create function app_private.apply_leave(
  p_leave_type_id uuid, p_start date, p_end date, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := app_private.require_my_employee();
  v_type    public.leave_types%rowtype;
  v_days    numeric;
  v_year    integer;
  v_used    numeric;
  v_reason  text := nullif(pg_catalog.btrim(p_reason), '');
  v_status  text;
  v_id      uuid;
begin
  if p_leave_type_id is null or p_start is null or p_end is null then
    raise exception 'Leave type, start date and end date are required.';
  end if;
  if p_end < p_start then
    raise exception 'The end date cannot be before the start date.';
  end if;
  if extract(year from p_start) <> extract(year from p_end) then
    raise exception 'A leave request must start and end in the same calendar year.';
  end if;
  v_year := extract(year from p_start)::integer;
  if v_year < extract(year from app_private.today_ist()) then
    raise exception 'Leave cannot be requested for a past year.';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'The reason can be at most 500 characters.';
  end if;

  select * into v_type from public.leave_types where id = p_leave_type_id;
  if not found or not v_type.is_active then
    raise exception 'Select an active leave type.';
  end if;

  -- Serialise this employee's leave operations (overlap and balance).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nexmile.leave.' || v_me::text));

  if exists (select 1 from public.leave_requests
             where employee_id = v_me
               and status in ('PENDING', 'APPROVED')
               and start_date <= p_end and end_date >= p_start) then
    raise exception 'These dates overlap one of your pending or approved leave requests.';
  end if;

  v_days := app_private.count_leave_days(v_me, p_start, p_end);
  if v_days <= 0 then
    raise exception 'The selected dates contain no working days.';
  end if;

  if v_type.is_paid then
    v_used := app_private.leave_days_used(v_me, v_type.id, v_year, array['APPROVED', 'PENDING']);
    if v_used + v_days > v_type.annual_allowance then
      raise exception 'Not enough % balance: % day(s) requested, % available (including pending requests).',
        v_type.name, v_days, greatest(v_type.annual_allowance - v_used, 0);
    end if;
  end if;

  v_status := case when v_type.requires_approval then 'PENDING' else 'APPROVED' end;

  insert into public.leave_requests
    (employee_id, leave_type_id, start_date, end_date, total_days, reason, status, decided_at)
  values
    (v_me, v_type.id, p_start, p_end, v_days, v_reason, v_status,
     case when v_status = 'APPROVED' then now() end)
  returning id into v_id;

  perform app_private.write_audit('leave_applied', 'leave_request', v_id,
    pg_catalog.jsonb_build_object('employee_id', v_me, 'leave_type', v_type.code,
                                  'start_date', p_start, 'end_date', p_end,
                                  'total_days', v_days, 'status', v_status));
  return v_id;
end;
$$;

create function app_private.cancel_my_leave(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := app_private.require_my_employee();
  v_req public.leave_requests%rowtype;
begin
  select * into v_req from public.leave_requests where id = p_id for update;
  if not found or v_req.employee_id <> v_me then
    raise exception 'Leave request not found.';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'Only pending leave requests can be cancelled.';
  end if;

  update public.leave_requests
     set status = 'CANCELLED', decided_at = now()
   where id = p_id;

  perform app_private.write_audit('leave_cancelled', 'leave_request', p_id,
    pg_catalog.jsonb_build_object('employee_id', v_me));
end;
$$;

create function app_private.decide_leave(p_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_me    uuid := app_private.my_employee_id();
  v_req   public.leave_requests%rowtype;
  v_type  public.leave_types%rowtype;
  v_note  text := nullif(pg_catalog.btrim(p_note), '');
  v_used  numeric;
  v_new   text;
begin
  if v_uid is null or p_id is null or p_approve is null then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'The decision note can be at most 500 characters.';
  end if;

  select * into v_req from public.leave_requests where id = p_id for update;
  if not found then
    raise exception 'Leave request not found.';
  end if;

  if v_me is not null and v_req.employee_id = v_me then
    raise exception 'You cannot decide your own leave request.' using errcode = '42501';
  end if;
  if not (app_private.is_direct_manager_of(v_req.employee_id)
          or app_private.user_has_permission(v_uid, 'employees.manage')) then
    -- Same message as "not found" so other teams' requests are not revealed.
    raise exception 'Leave request not found.';
  end if;

  if v_req.status <> 'PENDING' then
    raise exception 'Only pending leave requests can be decided.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nexmile.leave.' || v_req.employee_id::text));

  if p_approve then
    select * into v_type from public.leave_types where id = v_req.leave_type_id;
    if exists (select 1 from public.leave_requests
               where employee_id = v_req.employee_id and id <> v_req.id
                 and status = 'APPROVED'
                 and start_date <= v_req.end_date and end_date >= v_req.start_date) then
      raise exception 'This request overlaps leave that is already approved.';
    end if;
    if v_type.is_paid then
      v_used := app_private.leave_days_used(v_req.employee_id, v_type.id,
                  extract(year from v_req.start_date)::integer, array['APPROVED']);
      if v_used + v_req.total_days > v_type.annual_allowance then
        raise exception 'Approving would exceed the employee''s % balance.', v_type.name;
      end if;
    end if;
    v_new := 'APPROVED';
  else
    v_new := 'REJECTED';
  end if;

  update public.leave_requests
     set status = v_new, approver_id = v_me, decision_note = v_note, decided_at = now()
   where id = p_id;

  perform app_private.write_audit('leave_decided', 'leave_request', p_id,
    pg_catalog.jsonb_build_object('employee_id', v_req.employee_id, 'status', v_new,
                                  'note', v_note));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Training
-- ---------------------------------------------------------------------
create function app_private.update_my_training_status(p_enrollment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := app_private.require_my_employee();
  v_enr public.training_enrollments%rowtype;
begin
  if p_status is null or p_status not in ('IN_PROGRESS', 'COMPLETED') then
    raise exception 'Status must be IN_PROGRESS or COMPLETED.';
  end if;

  select * into v_enr from public.training_enrollments where id = p_enrollment_id for update;
  if not found or v_enr.employee_id <> v_me then
    raise exception 'Training enrolment not found.';
  end if;
  if v_enr.status = 'CANCELLED' then
    raise exception 'This enrolment has been cancelled.';
  end if;
  if v_enr.status = 'COMPLETED' then
    raise exception 'This course is already completed.';
  end if;
  if v_enr.status = p_status then
    return;
  end if;

  update public.training_enrollments
     set status = p_status,
         completed_at = case when p_status = 'COMPLETED' then now() else null end
   where id = p_enrollment_id;

  perform app_private.write_audit('training_status_updated', 'training_enrollment', p_enrollment_id,
    pg_catalog.jsonb_build_object('employee_id', v_me, 'from', v_enr.status, 'to', p_status));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Public wrappers
-- ---------------------------------------------------------------------
create function public.get_my_profile()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select app_private.get_my_profile(); $$;

create function public.update_my_phone(p_phone text)
returns void language sql security invoker set search_path = ''
as $$ select app_private.update_my_phone(p_phone); $$;

create function public.check_in()
returns uuid language sql security invoker set search_path = ''
as $$ select app_private.check_in(); $$;

create function public.check_out()
returns uuid language sql security invoker set search_path = ''
as $$ select app_private.check_out(); $$;

create function public.my_leave_balances(p_year integer default null)
returns table (
  leave_type_id uuid, code text, name text, is_paid boolean,
  annual_allowance numeric, approved_days numeric, pending_days numeric, balance numeric)
language sql stable security invoker set search_path = ''
as $$ select * from app_private.my_leave_balances(p_year); $$;

create function public.apply_leave(p_leave_type_id uuid, p_start date, p_end date, p_reason text)
returns uuid language sql security invoker set search_path = ''
as $$ select app_private.apply_leave(p_leave_type_id, p_start, p_end, p_reason); $$;

create function public.cancel_my_leave(p_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select app_private.cancel_my_leave(p_id); $$;

create function public.decide_leave(p_id uuid, p_approve boolean, p_note text)
returns void language sql security invoker set search_path = ''
as $$ select app_private.decide_leave(p_id, p_approve, p_note); $$;

create function public.update_my_training_status(p_enrollment_id uuid, p_status text)
returns void language sql security invoker set search_path = ''
as $$ select app_private.update_my_training_status(p_enrollment_id, p_status); $$;

-- ---------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------
revoke all on function app_private.today_ist()                                  from public, anon, authenticated, service_role;
revoke all on function app_private.require_my_employee()                        from public, anon, authenticated, service_role;
revoke all on function app_private.count_leave_days(uuid, date, date)           from public, anon, authenticated, service_role;
revoke all on function app_private.leave_days_used(uuid, uuid, integer, text[]) from public, anon, authenticated, service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'get_my_profile()', 'update_my_phone(text)', 'check_in()', 'check_out()',
    'my_leave_balances(integer)', 'apply_leave(uuid,date,date,text)',
    'cancel_my_leave(uuid)', 'decide_leave(uuid,boolean,text)',
    'update_my_training_status(uuid,text)']
  loop
    execute format('revoke all on function app_private.%s from public, anon, service_role', f);
    execute format('grant execute on function app_private.%s to authenticated', f);
    execute format('revoke all on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 8. Index (advisor: unindexed foreign key)
-- ---------------------------------------------------------------------
create index leave_requests_leave_type_id_idx on public.leave_requests (leave_type_id);

commit;
