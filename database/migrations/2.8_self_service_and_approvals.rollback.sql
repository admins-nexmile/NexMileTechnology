-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.8 (self-service and approvals)
-- =====================================================================
-- Run manually, only after explicit approval, after rolling back 2.9+.
-- Drops every function and the index created by 2.8. Data written through
-- these functions (attendance, leave requests, training status, phone
-- numbers, audit rows) is kept.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('app_private.apply_leave(uuid,date,date,text)') is null then
    raise exception 'rollback 2.8 aborted: 2.8 objects not found';
  end if;
  if to_regprocedure('app_private.admin_upsert_employee(uuid,jsonb)') is not null then
    raise exception 'rollback 2.8 aborted: roll back 2.9 first';
  end if;
end
$$;

drop function public.get_my_profile();
drop function public.update_my_phone(text);
drop function public.check_in();
drop function public.check_out();
drop function public.my_leave_balances(integer);
drop function public.apply_leave(uuid, date, date, text);
drop function public.cancel_my_leave(uuid);
drop function public.decide_leave(uuid, boolean, text);
drop function public.update_my_training_status(uuid, text);

drop function app_private.get_my_profile();
drop function app_private.update_my_phone(text);
drop function app_private.check_in();
drop function app_private.check_out();
drop function app_private.my_leave_balances(integer);
drop function app_private.apply_leave(uuid, date, date, text);
drop function app_private.cancel_my_leave(uuid);
drop function app_private.decide_leave(uuid, boolean, text);
drop function app_private.update_my_training_status(uuid, text);
drop function app_private.leave_days_used(uuid, uuid, integer, text[]);
drop function app_private.count_leave_days(uuid, date, date);
drop function app_private.require_my_employee();
drop function app_private.today_ist();

drop index public.leave_requests_leave_type_id_idx;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.8', 'at', now()), null);

commit;
