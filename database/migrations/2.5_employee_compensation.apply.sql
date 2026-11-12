-- =====================================================================
-- Nexmile HRMS — Migration 2.5: salary isolation (employee_compensation)
-- =====================================================================
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_5_employee_compensation);
--         tests ALL TESTS PASSED.
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.0–2.4 and 2.7 applied.
-- Rollback: database/migrations/2.5_employee_compensation.rollback.sql
-- Test:     database/tests/2.5_employee_compensation_tests.sql
-- Backup:   database/backups/2026-11-12T0000_employees.json (13 rows,
--           monthly_ctc total 927000.00), taken before applying.
--
-- Applied through Supabase MCP apply_migration, which runs the body in one
-- transaction; the begin/commit below are for SQL Editor use.
--
-- What this does
--   * Copies employees.monthly_ctc into employee_compensation, one row per
--     employee, effective_from = hire_date, effective_to = NULL (open).
--   * Verifies row count, per-employee values and the grand total match
--     before going further; any mismatch aborts the whole migration.
--   * Drops employees_monthly_ctc_check and employees.monthly_ctc, so no
--     salary remains on the employees table (which non-payroll roles will
--     be able to read after 2.6).
--   * Enforces at most one open compensation row per employee.
--   * employee_compensation: anon gets nothing; authenticated gets SELECT
--     only, filtered by a policy requiring compensation.read (held only by
--     super_admin and payroll_admin, enforced by 2.1 triggers).
--   * Writes go only through app_private.set_employee_compensation
--     (compensation.manage; never your own record; audited), exposed via a
--     SECURITY INVOKER wrapper for authenticated.
--
-- What this does NOT do
--   * No client INSERT/UPDATE/DELETE policies.
--   * No change to any other table's policies or grants.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.my_invitation_status()') is null then
    raise exception '2.5 aborted: migration 2.7 not found';
  end if;
  if to_regprocedure('app_private.set_employee_compensation(uuid,numeric,date)') is not null then
    raise exception '2.5 aborted: 2.5 objects already exist';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'employees'
                   and column_name = 'monthly_ctc') then
    raise exception '2.5 aborted: employees.monthly_ctc not found';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.employees'::regclass
                   and conname = 'employees_monthly_ctc_check') then
    raise exception '2.5 aborted: employees_monthly_ctc_check not found';
  end if;
  if (select count(*) from public.employee_compensation) <> 0 then
    raise exception '2.5 aborted: employee_compensation is not empty';
  end if;
  if (select count(*) from public.permissions
      where key in ('compensation.read', 'compensation.manage') and is_sensitive) <> 2 then
    raise exception '2.5 aborted: compensation permissions missing or not sensitive';
  end if;
  if exists (select 1 from public.role_permissions
             where permission_key like 'compensation.%'
               and role_key not in ('super_admin', 'payroll_admin')) then
    raise exception '2.5 aborted: a non-payroll role holds a compensation permission';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Copy salaries and verify
-- ---------------------------------------------------------------------
do $$
declare
  v_emp_count   bigint;
  v_emp_total   numeric;
  v_comp_count  bigint;
  v_comp_total  numeric;
begin
  select count(*), coalesce(sum(monthly_ctc), 0)
    into v_emp_count, v_emp_total
  from public.employees;

  insert into public.employee_compensation (employee_id, monthly_ctc, effective_from, effective_to)
  select e.id, e.monthly_ctc, e.hire_date, null
  from public.employees e;

  select count(*), coalesce(sum(monthly_ctc), 0)
    into v_comp_count, v_comp_total
  from public.employee_compensation;

  if v_comp_count <> v_emp_count then
    raise exception '2.5 aborted: copied % rows, expected %', v_comp_count, v_emp_count;
  end if;
  if v_comp_total <> v_emp_total then
    raise exception '2.5 aborted: compensation total does not match employees total';
  end if;
  if exists (
    select 1
    from public.employees e
    left join public.employee_compensation c on c.employee_id = e.id
    where c.id is null
       or c.monthly_ctc <> e.monthly_ctc
       or c.effective_from <> e.hire_date
       or c.effective_to is not null
  ) then
    raise exception '2.5 aborted: a copied compensation row does not match its employee';
  end if;

  -- Counts only; amounts are never written to the audit log here.
  perform app_private.write_audit('compensation_migrated', 'employee_compensation', null,
    pg_catalog.jsonb_build_object('rows', v_comp_count, 'source', 'employees.monthly_ctc'));
end
$$;

-- ---------------------------------------------------------------------
-- 2. Remove salary from employees
-- ---------------------------------------------------------------------
alter table public.employees drop constraint employees_monthly_ctc_check;
alter table public.employees drop column monthly_ctc;

-- ---------------------------------------------------------------------
-- 3. Integrity on employee_compensation
-- ---------------------------------------------------------------------
create unique index employee_compensation_one_open_per_employee_idx
  on public.employee_compensation (employee_id)
  where effective_to is null;

create trigger employee_compensation_set_updated_at
  before update on public.employee_compensation
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Privileges and read policy
-- ---------------------------------------------------------------------
revoke all on public.employee_compensation from public, anon, authenticated;
grant select on public.employee_compensation to authenticated;

create policy employee_compensation_select_compensation_read
  on public.employee_compensation
  for select to authenticated
  using ((select app_private.has_permission('compensation.read')));

-- ---------------------------------------------------------------------
-- 5. Write function (compensation.manage)
-- ---------------------------------------------------------------------
-- Sets an employee's monthly CTC from p_effective_from onwards.
--   * Same effective date as the open row: corrects that row in place.
--   * Later date: closes the open row the day before and opens a new one.
--   * Earlier date than the open row: rejected (no back-dating history).
--   * Nobody may change their own compensation.
create function app_private.set_employee_compensation(
  p_employee_id uuid, p_monthly_ctc numeric, p_effective_from date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_self     uuid;
  v_open     public.employee_compensation%rowtype;
  v_id       uuid;
begin
  if v_uid is null
     or not app_private.user_has_permission(v_uid, 'compensation.manage') then
    raise exception 'You do not have permission to manage compensation.'
      using errcode = '42501';
  end if;

  if p_employee_id is null or p_effective_from is null or p_monthly_ctc is null then
    raise exception 'Employee, monthly CTC and effective date are required.';
  end if;
  if p_monthly_ctc < 0 or p_monthly_ctc > 100000000 then
    raise exception 'Monthly CTC must be between 0 and 10,00,00,000.';
  end if;
  if p_monthly_ctc <> round(p_monthly_ctc, 2) then
    raise exception 'Monthly CTC can have at most two decimal places.';
  end if;

  select employee_id into v_self from public.profiles where id = v_uid;
  if v_self is not null and v_self = p_employee_id then
    raise exception 'You cannot change your own compensation.' using errcode = '42501';
  end if;

  perform 1 from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Employee not found.';
  end if;

  select * into v_open
  from public.employee_compensation
  where employee_id = p_employee_id and effective_to is null
  for update;

  if found and p_effective_from < v_open.effective_from then
    raise exception 'The effective date cannot be before the current record (%).',
      v_open.effective_from;
  end if;

  if found and p_effective_from = v_open.effective_from then
    update public.employee_compensation
       set monthly_ctc = p_monthly_ctc
     where id = v_open.id
    returning id into v_id;
  else
    if found then
      update public.employee_compensation
         set effective_to = p_effective_from - 1
       where id = v_open.id;
    end if;
    insert into public.employee_compensation (employee_id, monthly_ctc, effective_from)
    values (p_employee_id, p_monthly_ctc, p_effective_from)
    returning id into v_id;
  end if;

  perform app_private.write_audit('compensation_set', 'employee', p_employee_id,
    pg_catalog.jsonb_build_object(
      'compensation_id', v_id,
      'effective_from', p_effective_from,
      'previous_monthly_ctc', v_open.monthly_ctc,
      'monthly_ctc', p_monthly_ctc));
  return v_id;
end;
$$;

create function public.set_employee_compensation(
  p_employee_id uuid, p_monthly_ctc numeric, p_effective_from date)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select app_private.set_employee_compensation(p_employee_id, p_monthly_ctc, p_effective_from); $$;

revoke all on function app_private.set_employee_compensation(uuid, numeric, date) from public, anon, service_role;
grant execute on function app_private.set_employee_compensation(uuid, numeric, date) to authenticated;
revoke all on function public.set_employee_compensation(uuid, numeric, date) from public, anon, service_role;
grant execute on function public.set_employee_compensation(uuid, numeric, date) to authenticated;

commit;
