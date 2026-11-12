-- =====================================================================
-- Nexmile HRMS — Migration 2.6: scoped read access (own / team / all)
-- =====================================================================
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_6_scoped_read_access);
--         tests ALL TESTS PASSED.
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.5 applied.
-- Rollback: database/migrations/2.6_scoped_read_access.rollback.sql
-- Test:     database/tests/2.6_scoped_read_access_tests.sql
--
-- Applied through Supabase MCP apply_migration (one transaction).
--
-- Helpers (app_private, SECURITY DEFINER, empty search_path):
--   my_employee_id()            caller's linked employee, only for an
--                               ACTIVE profile with at least one role
--   my_department_id()          that employee's department
--   is_direct_manager_of(id)    caller holds the 'manager' role AND is
--                               employees.manager_id of that employee
--                               (both conditions: HR assigns the role,
--                               the org chart decides the team)
--
-- SELECT policies (authenticated only):
--   employees, attendance, leave_requests, training_enrollments:
--       own rows, direct reports, or employees.read_all
--   announcements: published, inside the publish window, and audience
--       ALL / caller's DEPARTMENT / MANAGERS (manager role);
--       employees.manage sees all (for administration)
--   training_courses: active courses; employees.manage sees all
--
-- Stay fully locked (no policies, and no table privileges for API roles):
--   payroll_runs, payroll_items, employee_documents, audit_logs,
--   company_settings. Access will only ever be through audited
--   SECURITY DEFINER functions.
--
-- Table privileges (defence in depth; RLS alone does not stop TRUNCATE):
--   * anon: all privileges revoked on every legacy table.
--   * authenticated: INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
--     revoked on every legacy table; SELECT kept only where a policy
--     exists. All writes go through functions.
--
-- Indexes: announcements(department_id) (FK), attendance(attendance_date).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if to_regprocedure('app_private.set_employee_compensation(uuid,numeric,date)') is null then
    raise exception '2.6 aborted: migration 2.5 not found';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employees'
               and column_name = 'monthly_ctc') then
    raise exception '2.6 aborted: employees.monthly_ctc still exists';
  end if;
  if to_regprocedure('app_private.my_employee_id()') is not null then
    raise exception '2.6 aborted: 2.6 objects already exist';
  end if;
  foreach t in array array['employees', 'attendance', 'leave_requests', 'training_enrollments',
                           'announcements', 'training_courses', 'payroll_runs', 'payroll_items',
                           'employee_documents', 'audit_logs', 'company_settings']
  loop
    if not (select relrowsecurity from pg_class where oid = to_regclass(format('public.%I', t))) then
      raise exception '2.6 aborted: RLS not enabled on public.%', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception '2.6 aborted: public.% already has policies', t;
    end if;
  end loop;
  if not exists (select 1 from public.roles where key = 'manager') then
    raise exception '2.6 aborted: manager role missing';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------
create function app_private.my_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.employee_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active'
    and exists (select 1 from public.user_roles ur where ur.user_id = p.id);
$$;

create function app_private.my_department_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.department_id
  from public.employees e
  where e.id = app_private.my_employee_id();
$$;

create function app_private.is_direct_manager_of(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_employee_id is not null
     and app_private.has_role('manager')
     and exists (
       select 1
       from public.employees e
       where e.id = p_employee_id
         and e.manager_id is not null
         and e.manager_id = app_private.my_employee_id()
     );
$$;

revoke all on function app_private.my_employee_id()            from public, anon, service_role;
revoke all on function app_private.my_department_id()          from public, anon, service_role;
revoke all on function app_private.is_direct_manager_of(uuid)  from public, anon, service_role;
grant execute on function app_private.my_employee_id()           to authenticated;
grant execute on function app_private.my_department_id()         to authenticated;
grant execute on function app_private.is_direct_manager_of(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Table privileges
-- ---------------------------------------------------------------------
-- Readable through policies: SELECT only for authenticated.
revoke all on public.employees, public.attendance, public.leave_requests,
              public.training_enrollments, public.announcements, public.training_courses,
              public.departments, public.leave_types, public.holidays
  from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.employees, public.attendance, public.leave_requests,
     public.training_enrollments, public.announcements, public.training_courses,
     public.departments, public.leave_types, public.holidays
  from authenticated;
grant select on public.employees, public.attendance, public.leave_requests,
                public.training_enrollments, public.announcements, public.training_courses,
                public.departments, public.leave_types, public.holidays
  to authenticated;

-- Fully locked for API roles.
revoke all on public.payroll_runs, public.payroll_items, public.employee_documents,
              public.audit_logs, public.company_settings
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Scoped SELECT policies
-- ---------------------------------------------------------------------
create policy employees_select_scoped on public.employees
  for select to authenticated
  using (
    id = (select app_private.my_employee_id())
    or (select app_private.has_permission('employees.read_all'))
    or app_private.is_direct_manager_of(id)
  );

create policy attendance_select_scoped on public.attendance
  for select to authenticated
  using (
    employee_id = (select app_private.my_employee_id())
    or (select app_private.has_permission('employees.read_all'))
    or app_private.is_direct_manager_of(employee_id)
  );

create policy leave_requests_select_scoped on public.leave_requests
  for select to authenticated
  using (
    employee_id = (select app_private.my_employee_id())
    or (select app_private.has_permission('employees.read_all'))
    or app_private.is_direct_manager_of(employee_id)
  );

create policy training_enrollments_select_scoped on public.training_enrollments
  for select to authenticated
  using (
    employee_id = (select app_private.my_employee_id())
    or (select app_private.has_permission('employees.read_all'))
    or app_private.is_direct_manager_of(employee_id)
  );

create policy announcements_select_audience on public.announcements
  for select to authenticated
  using (
    (select app_private.has_permission('employees.manage'))
    or (
      (select app_private.is_active_user())
      and is_published
      and published_at is not null
      and published_at <= now()
      and (expires_at is null or expires_at > now())
      and (
        audience = 'ALL'
        or (audience = 'DEPARTMENT' and department_id = (select app_private.my_department_id()))
        or (audience = 'MANAGERS' and (select app_private.has_role('manager')))
      )
    )
  );

create policy training_courses_select_active on public.training_courses
  for select to authenticated
  using (
    (select app_private.has_permission('employees.manage'))
    or ((select app_private.is_active_user()) and is_active)
  );

-- ---------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------
create index announcements_department_id_idx on public.announcements (department_id);
create index attendance_attendance_date_idx on public.attendance (attendance_date);

commit;
