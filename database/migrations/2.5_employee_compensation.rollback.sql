-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.5 (employee_compensation)
-- =====================================================================
-- Run manually, only after explicit approval. Roll back 2.6 first if it is
-- applied (2.6 depends on the column being gone, and changes the grants
-- this script restores).
--
-- Restores the pre-2.5 state exactly:
--   * re-adds employees.monthly_ctc numeric(12,2) NOT NULL DEFAULT 0 and
--     employees_monthly_ctc_check (monthly_ctc >= 0);
--   * fills it from each employee's OPEN compensation row (the current
--     salary; equal to the original value unless it was changed via
--     set_employee_compensation after 2.5);
--   * drops the 2.5 policy, functions, trigger and index;
--   * DELETES all rows from employee_compensation (it was empty before
--     2.5). Any compensation history recorded after 2.5 is lost, so export
--     the table to database/backups/ before running this;
--   * restores the original table grants on employee_compensation.
-- =====================================================================

begin;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employees'
               and column_name = 'monthly_ctc') then
    raise exception 'rollback 2.5 aborted: employees.monthly_ctc already exists';
  end if;
  if to_regprocedure('app_private.set_employee_compensation(uuid,numeric,date)') is null then
    raise exception 'rollback 2.5 aborted: 2.5 objects not found';
  end if;
  if to_regprocedure('app_private.my_employee_id()') is not null then
    raise exception 'rollback 2.5 aborted: roll back 2.6 first';
  end if;
end
$$;

alter table public.employees
  add column monthly_ctc numeric(12,2) not null default 0;
alter table public.employees
  add constraint employees_monthly_ctc_check check (monthly_ctc >= 0::numeric);

update public.employees e
   set monthly_ctc = c.monthly_ctc
  from public.employee_compensation c
 where c.employee_id = e.id and c.effective_to is null;

do $$
begin
  if exists (
    select 1 from public.employees e
    join public.employee_compensation c on c.employee_id = e.id and c.effective_to is null
    where e.monthly_ctc <> c.monthly_ctc
  ) then
    raise exception 'rollback 2.5 aborted: restored monthly_ctc does not match open compensation';
  end if;
end
$$;

drop policy employee_compensation_select_compensation_read on public.employee_compensation;
drop function public.set_employee_compensation(uuid, numeric, date);
drop function app_private.set_employee_compensation(uuid, numeric, date);
drop trigger employee_compensation_set_updated_at on public.employee_compensation;
drop index public.employee_compensation_one_open_per_employee_idx;

delete from public.employee_compensation;

-- Original grants (as found before 2.5).
grant select, insert, update, delete, truncate, references, trigger
  on public.employee_compensation to anon, authenticated;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.5', 'at', now()), null);

commit;
