-- =====================================================================
-- ONE-TIME DATA FIX — NOT A MIGRATION
-- Ensure employee NX013's work_email is vasikarvasu@gmail.com.
-- =====================================================================
-- STATUS: NOT RUN. Run once, manually, after explicit approval and after
-- migration 2.7 (personal Google accounts).
--
-- Context: sign-in now uses personal Google accounts, and an invitation
-- must match employees.work_email. NX013 signs in as
-- vasikarvasu@gmail.com.
--
-- Probably not needed: the earlier version of this fix was never run, so
-- NX013's work_email should still be vasikarvasu@gmail.com. Check first
-- (read-only):
--
--   select employee_code, work_email from public.employees
--   where employee_code = 'NX013';
--
-- If it already shows vasikarvasu@gmail.com, skip this file. If you do
-- run it anyway, it makes no change and only prints a notice.
--
-- When it does change the row, it requires:
--   * exactly one employee with employee_code = 'NX013';
--   * no other employee already using vasikarvasu@gmail.com;
-- and writes an audit_logs row with the old and new address.
-- Otherwise it raises an exception and nothing changes.
-- =====================================================================

begin;

do $$
declare
  v_new_email constant text := 'vasikarvasu@gmail.com';
  v_matches   integer;
  v_id        uuid;
  v_current   text;
begin
  select count(*) into v_matches
  from public.employees e
  where e.employee_code = 'NX013';
  if v_matches <> 1 then
    raise exception 'Data fix aborted: expected exactly 1 employee NX013, found %', v_matches;
  end if;

  select e.id, lower(trim(e.work_email)) into v_id, v_current
  from public.employees e
  where e.employee_code = 'NX013'
  for update;

  if v_current = v_new_email then
    raise notice 'NX013 work_email is already %; no change made', v_new_email;
    return;
  end if;

  if exists (select 1 from public.employees
             where lower(trim(work_email)) = v_new_email and id <> v_id) then
    raise exception 'Data fix aborted: % is already used by another employee', v_new_email;
  end if;

  update public.employees set work_email = v_new_email where id = v_id;

  insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
  values ('employee_work_email_fixed', 'employee', v_id,
          jsonb_build_object('employee_code', 'NX013', 'old', v_current,
                             'new', v_new_email, 'at', now(),
                             'reason', 'Personal Google account sign-in (2.7)'),
          null);

  raise notice 'NX013 work_email updated from % to %', v_current, v_new_email;
end
$$;

commit;
