-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.5 (employee_compensation)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK. Any failed expectation raises
-- "FAIL: ..."; if everything passes the last query returns
-- "ALL TESTS PASSED". Users are simulated as PostgREST does (SET ROLE +
-- request.jwt.claims). Test accounts use fictional @example.test emails.
--
--   1. employees.monthly_ctc no longer exists.
--   2. Every employee has exactly one open compensation row.
--   3. employee sees no compensation rows.
--   4. hr_admin sees no compensation rows and cannot set compensation.
--   5. payroll_admin reads all compensation rows.
--   6. payroll_admin sets a raise: old row closed, new row open, audited.
--   7. payroll_admin cannot change their own compensation.
--   8. Back-dating before the open row is rejected.
--   9. anon cannot read employee_compensation at all.
--  10. authenticated cannot write employee_compensation directly.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Setup: c501 employee (NX005), c502 hr_admin (NX002), c503 payroll_admin
-- (NX009). All active.
-- ---------------------------------------------------------------------
do $$
declare
  v_sa uuid;
begin
  select ur.user_id into v_sa from public.user_roles ur where ur.role_key = 'super_admin' limit 1;
  if v_sa is null then raise exception 'FAIL: setup: no super_admin'; end if;

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         v.email, now(), '{"provider":"google"}', '{}'::jsonb, now(), now()
  from (values
    ('00000000-0000-4000-8000-00000000c501', 't25.employee@example.test'),
    ('00000000-0000-4000-8000-00000000c502', 't25.hr@example.test'),
    ('00000000-0000-4000-8000-00000000c503', 't25.payroll@example.test')
  ) as v(id, email);

  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000c501'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000c502'::uuid, 'NX002'),
    ('00000000-0000-4000-8000-00000000c503'::uuid, 'NX009'));
  if (select count(*) from public.profiles
      where id::text like '00000000-0000-4000-8000-00000000c50%' and employee_id is not null) <> 3 then
    raise exception 'FAIL: setup: could not link test profiles to NX005/NX002/NX009';
  end if;

  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000c501', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000c502', 'hr_admin',      v_sa),
    ('00000000-0000-4000-8000-00000000c503', 'payroll_admin', v_sa);

  perform set_config('test.nx005', (select id::text from public.employees where employee_code = 'NX005'), true);
  perform set_config('test.nx009', (select id::text from public.employees where employee_code = 'NX009'), true);
  perform set_config('test.emp_count', (select count(*)::text from public.employees), true);
end
$$;

-- 1 & 2 (as owner)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employees'
               and column_name = 'monthly_ctc') then
    raise exception 'FAIL: 1: employees.monthly_ctc still exists';
  end if;
  if exists (select 1 from public.employees e
             where (select count(*) from public.employee_compensation c
                    where c.employee_id = e.id and c.effective_to is null) <> 1) then
    raise exception 'FAIL: 2: an employee does not have exactly one open compensation row';
  end if;
end
$$;

-- 3. employee
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c501","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.employee_compensation) <> 0 then
    raise exception 'FAIL: 3: employee can read compensation';
  end if;
end
$$;
reset role;

-- 4. hr_admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c502","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.employee_compensation) <> 0 then
    raise exception 'FAIL: 4: hr_admin can read compensation';
  end if;
  begin
    perform public.set_employee_compensation(current_setting('test.nx005')::uuid, 1, current_date);
    raise exception 'FAIL: 4: hr_admin set compensation';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You do not have permission to manage compensation%' then
      raise exception 'FAIL: 4: unexpected error: %', sqlerrm;
    end if;
  end;
end
$$;
reset role;

-- 5–8. payroll_admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c503","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_new uuid;
  v_emp uuid := current_setting('test.nx005')::uuid;
begin
  if (select count(*) from public.employee_compensation) <> current_setting('test.emp_count')::bigint then
    raise exception 'FAIL: 5: payroll_admin does not see every compensation row';
  end if;

  v_new := public.set_employee_compensation(v_emp, 70000, date '2026-12-01');
  if (select count(*) from public.employee_compensation
      where employee_id = v_emp and effective_to is null) <> 1
     or (select monthly_ctc from public.employee_compensation where id = v_new) <> 70000
     or not exists (select 1 from public.employee_compensation
                    where employee_id = v_emp and effective_to = date '2026-11-30') then
    raise exception 'FAIL: 6: raise did not close the old row and open a new one';
  end if;

  begin
    perform public.set_employee_compensation(current_setting('test.nx009')::uuid, 1, date '2026-12-01');
    raise exception 'FAIL: 7: payroll_admin changed own compensation';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You cannot change your own compensation%' then
      raise exception 'FAIL: 7: unexpected error: %', sqlerrm;
    end if;
  end;

  begin
    perform public.set_employee_compensation(v_emp, 1, date '2020-01-01');
    raise exception 'FAIL: 8: back-dated compensation accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'The effective date cannot be before%' then
      raise exception 'FAIL: 8: unexpected error: %', sqlerrm;
    end if;
  end;
end
$$;

-- 10. no direct writes even for payroll_admin
do $$
begin
  begin
    update public.employee_compensation set monthly_ctc = 1;
    raise exception 'FAIL: 10: direct UPDATE on employee_compensation allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.employee_compensation (employee_id, monthly_ctc, effective_from)
    values (current_setting('test.nx005')::uuid, 1, current_date);
    raise exception 'FAIL: 10: direct INSERT on employee_compensation allowed';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

do $$
begin
  if not exists (select 1 from public.audit_logs
                 where action = 'compensation_set'
                   and entity_id = current_setting('test.nx005')::uuid) then
    raise exception 'FAIL: 6: compensation change not audited';
  end if;
end
$$;

-- 9. anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform count(*) from public.employee_compensation;
  raise exception 'FAIL: 9: anon could query employee_compensation';
exception when insufficient_privilege then null;
end
$$;
reset role;

select 'ALL TESTS PASSED' as result;

rollback;
