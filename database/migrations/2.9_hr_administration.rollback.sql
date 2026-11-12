-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.9 (HR administration)
-- =====================================================================
-- Run manually, only after explicit approval, after rolling back 2.10+.
-- Drops every function created by 2.9. Data written through them
-- (employees, departments, leave types, holidays, announcements, courses,
-- enrolments, role and status changes, audit rows) is kept.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('app_private.admin_create_employee(jsonb)') is null then
    raise exception 'rollback 2.9 aborted: 2.9 objects not found';
  end if;
  if to_regprocedure('app_private.payroll_create_run(text,date,date,date,text)') is not null then
    raise exception 'rollback 2.9 aborted: roll back 2.10 first';
  end if;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_create_employee(jsonb)', 'admin_update_employee(uuid,jsonb)',
    'admin_set_manager(uuid,uuid)', 'admin_set_department(uuid,uuid)',
    'admin_set_employment_status(uuid,text)', 'admin_save_department(uuid,text,text)',
    'admin_save_leave_type(uuid,jsonb)', 'admin_save_holiday(uuid,text,date,text,text)',
    'admin_delete_holiday(uuid)', 'admin_save_announcement(uuid,jsonb)',
    'admin_save_course(uuid,jsonb)', 'admin_enroll(uuid,uuid)', 'admin_cancel_enrollment(uuid)',
    'admin_list_users()', 'admin_set_user_role(uuid,text,boolean)', 'admin_set_user_status(uuid,text)']
  loop
    execute format('drop function public.%s', f);
    execute format('drop function app_private.%s', f);
  end loop;
  foreach f in array array[
    'check_manager(uuid,uuid)', 'manager_creates_cycle(uuid,uuid)', 'validate_employee_fields(jsonb)',
    'user_can_assign_role(uuid,uuid,text)', 'assert_not_self(uuid)',
    'clean_text(text,integer,text,boolean)', 'assert_keys(jsonb,text[])', 'require_permission(text)']
  loop
    execute format('drop function app_private.%s', f);
  end loop;
end
$$;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.9', 'at', now()), null);

commit;
