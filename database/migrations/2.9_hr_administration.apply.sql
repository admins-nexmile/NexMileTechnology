-- =====================================================================
-- Nexmile HRMS â€” Migration 2.9: HR administration and user management
-- =====================================================================
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_9_hr_administration);
--         tests ALL TESTS PASSED (after fixing a test-only RLS visibility check).
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.8 applied.
-- Rollback: database/migrations/2.9_hr_administration.rollback.sql
-- Test:     database/tests/2.9_hr_administration_tests.sql
--
-- Applied through Supabase MCP apply_migration (one transaction).
--
-- All functions: app_private SECURITY DEFINER, empty search_path,
-- audited; public SECURITY INVOKER wrappers for authenticated only.
--
-- employees.manage (HR Admin, Super Admin):
--   admin_create_employee(data)            strict field list, no salary
--   admin_update_employee(id, data)        strict field list, no salary,
--                                          never your own record
--   admin_set_manager(id, manager)         rejects self and cycles
--   admin_set_department(id, department)
--   admin_set_employment_status(id, status)
--   admin_save_department(id, name, description)
--   admin_save_leave_type(id, data)
--   admin_save_holiday(...) / admin_delete_holiday(id)
--   admin_save_announcement(id, data)
--   admin_save_course(id, data)
--   admin_enroll(course, employee) / admin_cancel_enrollment(id)
--
-- users.read (HR Admin, Super Admin):
--   admin_list_users()                     accounts with roles
--
-- Role and status changes:
--   admin_set_user_role(user, role, grant)
--       super_admin: any role; hr_admin: only manager / employee, and only
--       on accounts whose roles are all manager / employee. Never your own
--       account. The 2.2 trigger still guards the last active super_admin.
--   admin_set_user_status(user, status)    roles.manage (super_admin only),
--       active <-> suspended, never your own account, last-super-admin
--       guard applies.
--
-- No table, column, policy or grant changes on existing tables.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.apply_leave(uuid,date,date,text)') is null then
    raise exception '2.9 aborted: migration 2.8 not found';
  end if;
  if to_regprocedure('app_private.admin_create_employee(jsonb)') is not null then
    raise exception '2.9 aborted: 2.9 objects already exist';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'user_roles_guard_last_super_admin')
     or not exists (select 1 from pg_trigger where tgname = 'profiles_guard_last_super_admin') then
    raise exception '2.9 aborted: last-super-admin guards (2.2) missing';
  end if;
  if (select count(*) from public.role_permissions
      where permission_key = 'roles.manage') <> 1
     or not exists (select 1 from public.role_permissions
                    where permission_key = 'roles.manage' and role_key = 'super_admin') then
    raise exception '2.9 aborted: roles.manage must be held by super_admin only';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Private helpers
-- ---------------------------------------------------------------------
create function app_private.require_permission(p_permission text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not app_private.user_has_permission(v_uid, p_permission) then
    raise exception 'You do not have permission to do that.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Rejects any key outside p_allowed (e.g. salary fields).
create function app_private.assert_keys(p_data jsonb, p_allowed text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
begin
  if p_data is null or pg_catalog.jsonb_typeof(p_data) <> 'object' then
    raise exception 'Invalid data.';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_data) loop
    if not (k = any (p_allowed)) then
      raise exception 'Unknown or not allowed field: %', k;
    end if;
  end loop;
end;
$$;

create function app_private.clean_text(p_value text, p_max integer, p_label text, p_required boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nullif(pg_catalog.btrim(p_value), '');
begin
  if v is null and p_required then
    raise exception '% is required.', p_label;
  end if;
  if v is not null and length(v) > p_max then
    raise exception '% can be at most % characters.', p_label, p_max;
  end if;
  return v;
end;
$$;

-- Refuses admin changes to the caller's own employee record.
create function app_private.assert_not_self(p_employee_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_employee_id is not null and p_employee_id = app_private.my_employee_id() then
    raise exception 'You cannot change your own employee record. Ask another administrator.'
      using errcode = '42501';
  end if;
end;
$$;

create function app_private.user_can_assign_role(p_caller uuid, p_target uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_caller is not null and p_target is not null and p_caller <> p_target
     and exists (select 1 from public.roles where key = p_role)
     and (
       app_private.user_has_role(p_caller, 'super_admin')
       or (
         app_private.user_has_role(p_caller, 'hr_admin')
         and p_role in ('manager', 'employee')
         and not exists (select 1 from public.user_roles ur
                         where ur.user_id = p_target
                           and ur.role_key not in ('manager', 'employee'))
       )
     );
$$;

-- ---------------------------------------------------------------------
-- 2. Employees
-- ---------------------------------------------------------------------
create function app_private.validate_employee_fields(p_data jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_data ? 'employee_code'
     and coalesce(p_data ->> 'employee_code', '') !~ '^[A-Z0-9][A-Z0-9-]{1,19}$' then
    raise exception 'Employee code must be 2â€“20 characters: capital letters, digits or dashes.';
  end if;
  if p_data ? 'work_email'
     and lower(pg_catalog.btrim(coalesce(p_data ->> 'work_email', ''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid work email address.';
  end if;
  if p_data ? 'phone' and nullif(pg_catalog.btrim(p_data ->> 'phone'), '') is not null
     and pg_catalog.btrim(p_data ->> 'phone') !~ '^\+?[0-9][0-9 -]{6,18}[0-9]$' then
    raise exception 'Enter a valid phone number.';
  end if;
  if p_data ? 'employment_type'
     and coalesce(p_data ->> 'employment_type', '') not in ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') then
    raise exception 'Invalid employment type.';
  end if;
  if p_data ? 'employment_status'
     and coalesce(p_data ->> 'employment_status', '') not in ('ACTIVE', 'ON_LEAVE', 'NOTICE_PERIOD', 'INACTIVE') then
    raise exception 'Invalid employment status.';
  end if;
  if p_data ? 'hire_date' then
    begin
      perform (p_data ->> 'hire_date')::date;
    exception when others then
      raise exception 'Enter a valid hire date.';
    end;
    if (p_data ->> 'hire_date') is null then
      raise exception 'Hire date is required.';
    end if;
  end if;
  if p_data ? 'department_id' and (p_data ->> 'department_id') is not null
     and not exists (select 1 from public.departments
                     where id::text = p_data ->> 'department_id') then
    raise exception 'Department not found.';
  end if;
end;
$$;

-- Cycle check: would making p_manager the manager of p_employee create a loop?
create function app_private.manager_creates_cycle(p_employee uuid, p_manager uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain(id, depth) as (
    select p_manager, 0
    union all
    select e.manager_id, c.depth + 1
    from public.employees e
    join chain c on e.id = c.id
    where e.manager_id is not null and c.depth < 200
  )
  select p_manager is not null and exists (select 1 from chain where id = p_employee);
$$;

create function app_private.check_manager(p_employee uuid, p_manager uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_manager is null then
    return;
  end if;
  if p_employee is not null and p_manager = p_employee then
    raise exception 'An employee cannot be their own manager.';
  end if;
  if not exists (select 1 from public.employees
                 where id = p_manager and employment_status <> 'INACTIVE') then
    raise exception 'The manager must be an existing, non-inactive employee.';
  end if;
  if p_employee is not null and app_private.manager_creates_cycle(p_employee, p_manager) then
    raise exception 'That manager would create a reporting cycle.';
  end if;
end;
$$;

create function app_private.admin_create_employee(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_email   text;
  v_code    text;
  v_manager uuid;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_keys(p_data, array[
    'employee_code', 'first_name', 'middle_name', 'last_name', 'work_email', 'phone',
    'designation', 'employment_type', 'employment_status', 'hire_date', 'work_location',
    'department_id', 'manager_id']);
  if not (p_data ? 'employee_code' and p_data ? 'work_email' and p_data ? 'hire_date') then
    raise exception 'Employee code, work email and hire date are required.';
  end if;
  perform app_private.validate_employee_fields(p_data);

  v_code  := pg_catalog.btrim(p_data ->> 'employee_code');
  v_email := lower(pg_catalog.btrim(p_data ->> 'work_email'));
  v_manager := nullif(p_data ->> 'manager_id', '')::uuid;
  perform app_private.check_manager(null, v_manager);

  if exists (select 1 from public.employees where employee_code = v_code) then
    raise exception 'Employee code % is already in use.', v_code;
  end if;
  if exists (select 1 from public.employees where lower(work_email) = v_email) then
    raise exception 'Another employee already uses this work email.';
  end if;

  insert into public.employees (
    employee_code, first_name, middle_name, last_name, work_email, phone, designation,
    employment_type, employment_status, hire_date, work_location, department_id, manager_id)
  values (
    v_code,
    app_private.clean_text(p_data ->> 'first_name', 100, 'First name', true),
    app_private.clean_text(p_data ->> 'middle_name', 100, 'Middle name', false),
    app_private.clean_text(p_data ->> 'last_name', 100, 'Last name', true),
    v_email,
    nullif(pg_catalog.btrim(p_data ->> 'phone'), ''),
    app_private.clean_text(p_data ->> 'designation', 150, 'Designation', true),
    coalesce(p_data ->> 'employment_type', 'FULL_TIME'),
    coalesce(p_data ->> 'employment_status', 'ACTIVE'),
    (p_data ->> 'hire_date')::date,
    coalesce(app_private.clean_text(p_data ->> 'work_location', 100, 'Work location', false), 'Bengaluru'),
    nullif(p_data ->> 'department_id', '')::uuid,
    v_manager)
  returning id into v_id;

  perform app_private.write_audit('employee_created', 'employee', v_id,
    pg_catalog.jsonb_build_object('employee_code', v_code));
  return v_id;
end;
$$;

create function app_private.admin_update_employee(p_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old   public.employees%rowtype;
  v_email text;
  v_code  text;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_not_self(p_id);
  perform app_private.assert_keys(p_data, array[
    'employee_code', 'first_name', 'middle_name', 'last_name', 'work_email', 'phone',
    'designation', 'employment_type', 'hire_date', 'work_location']);
  perform app_private.validate_employee_fields(p_data);

  select * into v_old from public.employees where id = p_id for update;
  if not found then
    raise exception 'Employee not found.';
  end if;

  v_code  := coalesce(pg_catalog.btrim(p_data ->> 'employee_code'), v_old.employee_code);
  v_email := coalesce(lower(pg_catalog.btrim(p_data ->> 'work_email')), v_old.work_email);
  if v_code <> v_old.employee_code
     and exists (select 1 from public.employees where employee_code = v_code and id <> p_id) then
    raise exception 'Employee code % is already in use.', v_code;
  end if;
  if v_email <> lower(v_old.work_email)
     and exists (select 1 from public.employees where lower(work_email) = v_email and id <> p_id) then
    raise exception 'Another employee already uses this work email.';
  end if;

  update public.employees set
    employee_code   = v_code,
    first_name      = case when p_data ? 'first_name'
                           then app_private.clean_text(p_data ->> 'first_name', 100, 'First name', true)
                           else first_name end,
    middle_name     = case when p_data ? 'middle_name'
                           then app_private.clean_text(p_data ->> 'middle_name', 100, 'Middle name', false)
                           else middle_name end,
    last_name       = case when p_data ? 'last_name'
                           then app_private.clean_text(p_data ->> 'last_name', 100, 'Last name', true)
                           else last_name end,
    work_email      = v_email,
    phone           = case when p_data ? 'phone'
                           then nullif(pg_catalog.btrim(p_data ->> 'phone'), '')
                           else phone end,
    designation     = case when p_data ? 'designation'
                           then app_private.clean_text(p_data ->> 'designation', 150, 'Designation', true)
                           else designation end,
    employment_type = coalesce(p_data ->> 'employment_type', employment_type),
    hire_date       = coalesce((p_data ->> 'hire_date')::date, hire_date),
    work_location   = case when p_data ? 'work_location'
                           then app_private.clean_text(p_data ->> 'work_location', 100, 'Work location', false)
                           else work_location end,
    updated_at      = now()
  where id = p_id;

  perform app_private.write_audit('employee_updated', 'employee', p_id,
    pg_catalog.jsonb_build_object('fields', (select pg_catalog.jsonb_agg(k)
                                             from pg_catalog.jsonb_object_keys(p_data) k)));
end;
$$;

create function app_private.admin_set_manager(p_employee_id uuid, p_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_not_self(p_employee_id);
  -- Serialise org-chart changes so two concurrent edits cannot form a cycle.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nexmile.org_chart'));

  select manager_id into v_old from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Employee not found.';
  end if;
  perform app_private.check_manager(p_employee_id, p_manager_id);

  update public.employees set manager_id = p_manager_id, updated_at = now() where id = p_employee_id;
  perform app_private.write_audit('employee_manager_set', 'employee', p_employee_id,
    pg_catalog.jsonb_build_object('from', v_old, 'to', p_manager_id));
end;
$$;

create function app_private.admin_set_department(p_employee_id uuid, p_department_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_not_self(p_employee_id);
  select department_id into v_old from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Employee not found.';
  end if;
  if p_department_id is not null and not exists (select 1 from public.departments where id = p_department_id) then
    raise exception 'Department not found.';
  end if;
  update public.employees set department_id = p_department_id, updated_at = now() where id = p_employee_id;
  perform app_private.write_audit('employee_department_set', 'employee', p_employee_id,
    pg_catalog.jsonb_build_object('from', v_old, 'to', p_department_id));
end;
$$;

create function app_private.admin_set_employment_status(p_employee_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_not_self(p_employee_id);
  if p_status is null or p_status not in ('ACTIVE', 'ON_LEAVE', 'NOTICE_PERIOD', 'INACTIVE') then
    raise exception 'Invalid employment status.';
  end if;
  select employment_status into v_old from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Employee not found.';
  end if;
  update public.employees set employment_status = p_status, updated_at = now() where id = p_employee_id;
  perform app_private.write_audit('employee_status_set', 'employee', p_employee_id,
    pg_catalog.jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Reference data
-- ---------------------------------------------------------------------
create function app_private.admin_save_department(p_id uuid, p_name text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := app_private.clean_text(p_name, 100, 'Department name', true);
  v_desc text := app_private.clean_text(p_description, 500, 'Description', false);
  v_id   uuid;
begin
  perform app_private.require_permission('employees.manage');
  if exists (select 1 from public.departments
             where lower(name) = lower(v_name) and (p_id is null or id <> p_id)) then
    raise exception 'A department with this name already exists.';
  end if;
  if p_id is null then
    insert into public.departments (name, description) values (v_name, v_desc) returning id into v_id;
  else
    update public.departments set name = v_name, description = v_desc where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Department not found.';
    end if;
  end if;
  perform app_private.write_audit(case when p_id is null then 'department_created' else 'department_updated' end,
    'department', v_id, pg_catalog.jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

create function app_private.admin_save_leave_type(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_code  text;
  v_allow numeric;
  v_id    uuid;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_keys(p_data, array['name', 'code', 'annual_allowance', 'is_paid',
                                                'requires_approval', 'is_active']);
  v_name := app_private.clean_text(p_data ->> 'name', 100, 'Name', true);
  v_code := upper(app_private.clean_text(p_data ->> 'code', 10, 'Code', true));
  if v_code !~ '^[A-Z]{1,10}$' then
    raise exception 'Code must be 1â€“10 capital letters.';
  end if;
  begin
    v_allow := coalesce((p_data ->> 'annual_allowance')::numeric, 0);
  exception when others then
    raise exception 'Annual allowance must be a number.';
  end;
  if v_allow < 0 or v_allow > 365 or v_allow <> round(v_allow * 2) / 2 then
    raise exception 'Annual allowance must be between 0 and 365 in steps of 0.5.';
  end if;
  if exists (select 1 from public.leave_types
             where (lower(name) = lower(v_name) or code = v_code) and (p_id is null or id <> p_id)) then
    raise exception 'A leave type with this name or code already exists.';
  end if;

  if p_id is null then
    insert into public.leave_types (name, code, annual_allowance, is_paid, requires_approval, is_active)
    values (v_name, v_code, v_allow,
            coalesce((p_data ->> 'is_paid')::boolean, true),
            coalesce((p_data ->> 'requires_approval')::boolean, true),
            coalesce((p_data ->> 'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.leave_types set
      name = v_name, code = v_code, annual_allowance = v_allow,
      is_paid = coalesce((p_data ->> 'is_paid')::boolean, is_paid),
      requires_approval = coalesce((p_data ->> 'requires_approval')::boolean, requires_approval),
      is_active = coalesce((p_data ->> 'is_active')::boolean, is_active)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Leave type not found.';
    end if;
  end if;
  perform app_private.write_audit(case when p_id is null then 'leave_type_created' else 'leave_type_updated' end,
    'leave_type', v_id, p_data);
  return v_id;
end;
$$;

create function app_private.admin_save_holiday(
  p_id uuid, p_name text, p_date date, p_location text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := app_private.clean_text(p_name, 100, 'Holiday name', true);
  v_loc  text := coalesce(app_private.clean_text(p_location, 100, 'Location', false), 'India');
  v_desc text := app_private.clean_text(p_description, 500, 'Description', false);
  v_id   uuid;
begin
  perform app_private.require_permission('employees.manage');
  if p_date is null then
    raise exception 'Holiday date is required.';
  end if;
  if exists (select 1 from public.holidays
             where holiday_date = p_date and location = v_loc and (p_id is null or id <> p_id)) then
    raise exception 'There is already a holiday on this date for %.', v_loc;
  end if;
  if p_id is null then
    insert into public.holidays (name, holiday_date, location, description)
    values (v_name, p_date, v_loc, v_desc) returning id into v_id;
  else
    update public.holidays set name = v_name, holiday_date = p_date, location = v_loc, description = v_desc
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Holiday not found.';
    end if;
  end if;
  perform app_private.write_audit(case when p_id is null then 'holiday_created' else 'holiday_updated' end,
    'holiday', v_id, pg_catalog.jsonb_build_object('name', v_name, 'date', p_date, 'location', v_loc));
  return v_id;
end;
$$;

create function app_private.admin_delete_holiday(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.holidays%rowtype;
begin
  perform app_private.require_permission('employees.manage');
  delete from public.holidays where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Holiday not found.';
  end if;
  perform app_private.write_audit('holiday_deleted', 'holiday', p_id,
    pg_catalog.jsonb_build_object('name', v_row.name, 'date', v_row.holiday_date, 'location', v_row.location));
end;
$$;

create function app_private.admin_save_announcement(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title    text;
  v_body     text;
  v_audience text;
  v_dept     uuid;
  v_pub      boolean;
  v_pub_at   timestamptz;
  v_exp_at   timestamptz;
  v_id       uuid;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_keys(p_data, array['title', 'body', 'audience', 'department_id',
                                                'is_published', 'published_at', 'expires_at']);
  v_title    := app_private.clean_text(p_data ->> 'title', 200, 'Title', true);
  v_body     := app_private.clean_text(p_data ->> 'body', 5000, 'Message', true);
  v_audience := coalesce(p_data ->> 'audience', 'ALL');
  if v_audience not in ('ALL', 'DEPARTMENT', 'MANAGERS') then
    raise exception 'Invalid audience.';
  end if;
  v_dept := nullif(p_data ->> 'department_id', '')::uuid;
  if v_audience = 'DEPARTMENT' then
    if v_dept is null or not exists (select 1 from public.departments where id = v_dept) then
      raise exception 'Choose a department for a department announcement.';
    end if;
  else
    v_dept := null;
  end if;
  v_pub    := coalesce((p_data ->> 'is_published')::boolean, false);
  v_pub_at := nullif(p_data ->> 'published_at', '')::timestamptz;
  v_exp_at := nullif(p_data ->> 'expires_at', '')::timestamptz;
  if v_pub and v_pub_at is null then
    v_pub_at := now();
  end if;
  if v_exp_at is not null and v_pub_at is not null and v_exp_at <= v_pub_at then
    raise exception 'The expiry must be after the publish time.';
  end if;

  if p_id is null then
    insert into public.announcements (title, body, audience, department_id, is_published, published_at, expires_at)
    values (v_title, v_body, v_audience, v_dept, v_pub, v_pub_at, v_exp_at)
    returning id into v_id;
  else
    update public.announcements set
      title = v_title, body = v_body, audience = v_audience, department_id = v_dept,
      is_published = v_pub, published_at = v_pub_at, expires_at = v_exp_at
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Announcement not found.';
    end if;
  end if;
  perform app_private.write_audit(case when p_id is null then 'announcement_created' else 'announcement_updated' end,
    'announcement', v_id,
    pg_catalog.jsonb_build_object('title', v_title, 'audience', v_audience, 'published', v_pub));
  return v_id;
end;
$$;

create function app_private.admin_save_course(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_hours numeric;
  v_id    uuid;
begin
  perform app_private.require_permission('employees.manage');
  perform app_private.assert_keys(p_data, array['title', 'description', 'category',
                                                'duration_hours', 'is_mandatory', 'is_active']);
  v_title := app_private.clean_text(p_data ->> 'title', 200, 'Title', true);
  begin
    v_hours := coalesce(nullif(p_data ->> 'duration_hours', '')::numeric, 0);
  exception when others then
    raise exception 'Duration must be a number of hours.';
  end;
  if v_hours < 0 or v_hours > 1000 then
    raise exception 'Duration must be between 0 and 1000 hours.';
  end if;

  if p_id is null then
    insert into public.training_courses (title, description, category, duration_hours, is_mandatory, is_active)
    values (v_title,
            app_private.clean_text(p_data ->> 'description', 2000, 'Description', false),
            app_private.clean_text(p_data ->> 'category', 100, 'Category', false),
            v_hours,
            coalesce((p_data ->> 'is_mandatory')::boolean, false),
            coalesce((p_data ->> 'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.training_courses set
      title = v_title,
      description = case when p_data ? 'description'
                         then app_private.clean_text(p_data ->> 'description', 2000, 'Description', false)
                         else description end,
      category = case when p_data ? 'category'
                      then app_private.clean_text(p_data ->> 'category', 100, 'Category', false)
                      else category end,
      duration_hours = v_hours,
      is_mandatory = coalesce((p_data ->> 'is_mandatory')::boolean, is_mandatory),
      is_active = coalesce((p_data ->> 'is_active')::boolean, is_active)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Course not found.';
    end if;
  end if;
  perform app_private.write_audit(case when p_id is null then 'course_created' else 'course_updated' end,
    'training_course', v_id, pg_catalog.jsonb_build_object('title', v_title));
  return v_id;
end;
$$;

create function app_private.admin_enroll(p_course_id uuid, p_employee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.training_enrollments%rowtype;
  v_id       uuid;
begin
  perform app_private.require_permission('employees.manage');
  if not exists (select 1 from public.training_courses where id = p_course_id and is_active) then
    raise exception 'Choose an active course.';
  end if;
  if not exists (select 1 from public.employees where id = p_employee_id and employment_status <> 'INACTIVE') then
    raise exception 'Choose an active employee.';
  end if;

  select * into v_existing from public.training_enrollments
  where course_id = p_course_id and employee_id = p_employee_id for update;
  if found then
    if v_existing.status <> 'CANCELLED' then
      raise exception 'This employee is already enrolled in this course.';
    end if;
    update public.training_enrollments
       set status = 'ASSIGNED', assigned_at = now(), completed_at = null
     where id = v_existing.id returning id into v_id;
  else
    insert into public.training_enrollments (course_id, employee_id, status)
    values (p_course_id, p_employee_id, 'ASSIGNED') returning id into v_id;
  end if;
  perform app_private.write_audit('training_enrolled', 'training_enrollment', v_id,
    pg_catalog.jsonb_build_object('course_id', p_course_id, 'employee_id', p_employee_id));
  return v_id;
end;
$$;

create function app_private.admin_cancel_enrollment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform app_private.require_permission('employees.manage');
  select status into v_status from public.training_enrollments where id = p_id for update;
  if not found then
    raise exception 'Enrolment not found.';
  end if;
  if v_status in ('COMPLETED', 'CANCELLED') then
    raise exception 'Completed or cancelled enrolments cannot be cancelled.';
  end if;
  update public.training_enrollments set status = 'CANCELLED' where id = p_id;
  perform app_private.write_audit('training_enrollment_cancelled', 'training_enrollment', p_id, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Users and roles
-- ---------------------------------------------------------------------
create function app_private.admin_list_users()
returns table (
  user_id uuid, email text, full_name text, status text,
  employee_id uuid, employee_code text, employee_name text,
  roles text[], created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_permission('users.read');
  return query
  select p.id, p.email, p.full_name, p.status,
         p.employee_id, e.employee_code,
         app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
         coalesce((select array_agg(ur.role_key order by ur.role_key)
                   from public.user_roles ur where ur.user_id = p.id), array[]::text[]),
         p.created_at
  from public.profiles p
  left join public.employees e on e.id = p.employee_id
  where p.status <> 'pending' or exists (select 1 from public.user_roles ur where ur.user_id = p.id)
  order by p.email
  limit 1000;
end;
$$;

create function app_private.admin_set_user_role(p_user_id uuid, p_role text, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null or not app_private.is_active_user() then
    raise exception 'You do not have permission to do that.' using errcode = '42501';
  end if;
  if p_user_id is null or p_role is null or p_grant is null then
    raise exception 'User, role and action are required.';
  end if;
  if p_user_id = v_uid then
    raise exception 'You cannot change your own roles.' using errcode = '42501';
  end if;

  select status into v_status from public.profiles where id = p_user_id for update;
  if not found or v_status = 'pending' then
    raise exception 'User not found or has not accepted an invitation yet.';
  end if;

  if not app_private.user_can_assign_role(v_uid, p_user_id, p_role) then
    raise exception 'You are not allowed to change the % role for this user.', p_role
      using errcode = '42501';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role_key, granted_by)
    values (p_user_id, p_role, v_uid)
    on conflict (user_id, role_key) do nothing;
  else
    -- The 2.2 trigger blocks removing the last active super_admin.
    delete from public.user_roles where user_id = p_user_id and role_key = p_role;
  end if;
  -- user_roles_audit (2.2) records the grant / revoke itself.
end;
$$;

create function app_private.admin_set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_permission('roles.manage');
  v_old text;
begin
  if p_status is null or p_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended.';
  end if;
  if p_user_id = v_uid then
    raise exception 'You cannot change your own account status.' using errcode = '42501';
  end if;
  select status into v_old from public.profiles where id = p_user_id for update;
  if not found or v_old = 'pending' then
    raise exception 'User not found or has not accepted an invitation yet.';
  end if;
  if v_old = p_status then
    return;
  end if;
  -- profiles_guard_last_super_admin (2.2) blocks suspending the last one.
  update public.profiles set status = p_status where id = p_user_id;
  perform app_private.write_audit('user_status_set', 'user', p_user_id,
    pg_catalog.jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Public wrappers and privileges
-- ---------------------------------------------------------------------
create function public.admin_create_employee(p_data jsonb) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_create_employee(p_data); $$;
create function public.admin_update_employee(p_id uuid, p_data jsonb) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_update_employee(p_id, p_data); $$;
create function public.admin_set_manager(p_employee_id uuid, p_manager_id uuid) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_set_manager(p_employee_id, p_manager_id); $$;
create function public.admin_set_department(p_employee_id uuid, p_department_id uuid) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_set_department(p_employee_id, p_department_id); $$;
create function public.admin_set_employment_status(p_employee_id uuid, p_status text) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_set_employment_status(p_employee_id, p_status); $$;
create function public.admin_save_department(p_id uuid, p_name text, p_description text) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_save_department(p_id, p_name, p_description); $$;
create function public.admin_save_leave_type(p_id uuid, p_data jsonb) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_save_leave_type(p_id, p_data); $$;
create function public.admin_save_holiday(p_id uuid, p_name text, p_date date, p_location text, p_description text) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_save_holiday(p_id, p_name, p_date, p_location, p_description); $$;
create function public.admin_delete_holiday(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_delete_holiday(p_id); $$;
create function public.admin_save_announcement(p_id uuid, p_data jsonb) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_save_announcement(p_id, p_data); $$;
create function public.admin_save_course(p_id uuid, p_data jsonb) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_save_course(p_id, p_data); $$;
create function public.admin_enroll(p_course_id uuid, p_employee_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.admin_enroll(p_course_id, p_employee_id); $$;
create function public.admin_cancel_enrollment(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_cancel_enrollment(p_id); $$;
create function public.admin_list_users()
returns table (user_id uuid, email text, full_name text, status text, employee_id uuid,
               employee_code text, employee_name text, roles text[], created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from app_private.admin_list_users(); $$;
create function public.admin_set_user_role(p_user_id uuid, p_role text, p_grant boolean) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_set_user_role(p_user_id, p_role, p_grant); $$;
create function public.admin_set_user_status(p_user_id uuid, p_status text) returns void
language sql security invoker set search_path = '' as $$ select app_private.admin_set_user_status(p_user_id, p_status); $$;

do $$
declare
  f text;
begin
  -- Private helpers: owner only.
  foreach f in array array[
    'require_permission(text)', 'assert_keys(jsonb,text[])', 'clean_text(text,integer,text,boolean)',
    'assert_not_self(uuid)', 'user_can_assign_role(uuid,uuid,text)', 'validate_employee_fields(jsonb)',
    'manager_creates_cycle(uuid,uuid)', 'check_manager(uuid,uuid)']
  loop
    execute format('revoke all on function app_private.%s from public, anon, authenticated, service_role', f);
  end loop;

  -- Entry points: authenticated only (each checks permissions itself).
  foreach f in array array[
    'admin_create_employee(jsonb)', 'admin_update_employee(uuid,jsonb)',
    'admin_set_manager(uuid,uuid)', 'admin_set_department(uuid,uuid)',
    'admin_set_employment_status(uuid,text)', 'admin_save_department(uuid,text,text)',
    'admin_save_leave_type(uuid,jsonb)', 'admin_save_holiday(uuid,text,date,text,text)',
    'admin_delete_holiday(uuid)', 'admin_save_announcement(uuid,jsonb)',
    'admin_save_course(uuid,jsonb)', 'admin_enroll(uuid,uuid)', 'admin_cancel_enrollment(uuid)',
    'admin_list_users()', 'admin_set_user_role(uuid,text,boolean)', 'admin_set_user_status(uuid,text)']
  loop
    execute format('revoke all on function app_private.%s from public, anon, service_role', f);
    execute format('grant execute on function app_private.%s to authenticated', f);
    execute format('revoke all on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

commit;
