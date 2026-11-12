-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.10 (payroll workflow)
-- =====================================================================
-- Run manually, only after explicit approval, after rolling back 2.11+.
-- Drops the 2.10 functions, the two payroll_items CHECK constraints, the
-- payroll_runs_approved_by_idx index and the payroll_runs.approved_by /
-- paid_at columns. Values in approved_by / paid_at are LOST: export
-- payroll_runs to database/backups/ before running this. Payroll runs and
-- items themselves are kept.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('app_private.payroll_create_run(text,date,date,date,text)') is null then
    raise exception 'rollback 2.10 aborted: 2.10 objects not found';
  end if;
  if to_regprocedure('app_private.doc_register(uuid,text,text,text,boolean)') is not null then
    raise exception 'rollback 2.10 aborted: roll back 2.11 first';
  end if;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'payroll_create_run(text,date,date,date,text)',
    'payroll_update_run(uuid,text,date,date,date,text)',
    'payroll_set_run_status(uuid,text)',
    'payroll_upsert_item(uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,boolean)',
    'payroll_delete_item(uuid)', 'payroll_list_runs()', 'payroll_list_items(uuid)',
    'my_payslips()', 'my_payslip(uuid)']
  loop
    execute format('drop function public.%s', f);
    execute format('drop function app_private.%s', f);
  end loop;
end
$$;

alter table public.payroll_items drop constraint payroll_items_totals_consistent;
alter table public.payroll_items drop constraint payroll_items_amounts_non_negative;
drop index public.payroll_runs_approved_by_idx;
alter table public.payroll_runs drop column paid_at;
alter table public.payroll_runs drop column approved_by;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.10', 'at', now()), null);

commit;
