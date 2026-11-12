-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.6 (scoped read access)
-- =====================================================================
-- Run manually, only after explicit approval, and only after rolling back
-- every later migration that uses these helpers (2.8+).
--
-- Restores the pre-2.6 state exactly: drops the six SELECT policies, the
-- three helpers and the two indexes, and re-grants the table privileges
-- that existed before 2.6 (full privileges for anon and authenticated on
-- the 14 legacy tables; RLS still blocks rows that have no policy).
-- No data is changed.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('app_private.my_employee_id()') is null then
    raise exception 'rollback 2.6 aborted: 2.6 objects not found';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'app_private' and p.proname in ('check_in', 'apply_leave')) then
    raise exception 'rollback 2.6 aborted: roll back 2.8 first';
  end if;
end
$$;

drop policy employees_select_scoped            on public.employees;
drop policy attendance_select_scoped           on public.attendance;
drop policy leave_requests_select_scoped       on public.leave_requests;
drop policy training_enrollments_select_scoped on public.training_enrollments;
drop policy announcements_select_audience      on public.announcements;
drop policy training_courses_select_active     on public.training_courses;

drop function app_private.is_direct_manager_of(uuid);
drop function app_private.my_department_id();
drop function app_private.my_employee_id();

drop index public.announcements_department_id_idx;
drop index public.attendance_attendance_date_idx;

grant select, insert, update, delete, truncate, references, trigger
  on public.company_settings, public.departments, public.employees, public.leave_types,
     public.holidays, public.attendance, public.leave_requests, public.payroll_runs,
     public.payroll_items, public.announcements, public.training_courses,
     public.training_enrollments, public.employee_documents, public.audit_logs
  to anon, authenticated;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.6', 'at', now()), null);

commit;
