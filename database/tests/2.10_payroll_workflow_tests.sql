-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.10 (payroll workflow)
-- =====================================================================
-- SAFE: one transaction ending in ROLLBACK. Failures raise "FAIL: ...";
-- success returns "ALL TESTS PASSED". Fictional @example.test accounts.
--
-- Accounts: g101 employee NX005; g102 employee NX004; g103 hr_admin
--           NX002; g104 payroll_admin NX009.
--
--  1. employee and hr_admin cannot use payroll functions or list runs
--  2. payroll_admin creates a run; totals computed server-side
--  3. negative amounts and deductions > gross rejected
--  4. payroll_admin cannot enter their own item
--  5. invalid transitions rejected; empty run cannot be submitted
--  6. items locked once PENDING_APPROVAL
--  7. employee sees no payslip before APPROVED; sees own after APPROVED;
--     never test-data items; never other employees' payslips
--  8. PAID keeps the payslip visible; approved_by / paid_at recorded
--  9. nobody can query payroll tables directly; constraints hold
-- =====================================================================

begin;

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
    ('00000000-0000-4000-8000-00000000a201', 't210.emp5@example.test'),
    ('00000000-0000-4000-8000-00000000a202', 't210.emp4@example.test'),
    ('00000000-0000-4000-8000-00000000a203', 't210.hr@example.test'),
    ('00000000-0000-4000-8000-00000000a204', 't210.payroll@example.test')
  ) as v(id, email);

  update public.profiles p set status = 'active', employee_id = e.id
  from public.employees e
  where (p.id, e.employee_code) in (
    ('00000000-0000-4000-8000-00000000a201'::uuid, 'NX005'),
    ('00000000-0000-4000-8000-00000000a202'::uuid, 'NX004'),
    ('00000000-0000-4000-8000-00000000a203'::uuid, 'NX002'),
    ('00000000-0000-4000-8000-00000000a204'::uuid, 'NX009'));
  if (select count(*) from public.profiles
      where id::text like '00000000-0000-4000-8000-00000000a20%' and employee_id is not null) <> 4 then
    raise exception 'FAIL: setup: could not link test profiles';
  end if;
  insert into public.user_roles (user_id, role_key, granted_by) values
    ('00000000-0000-4000-8000-00000000a201', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000a202', 'employee',      v_sa),
    ('00000000-0000-4000-8000-00000000a203', 'hr_admin',      v_sa),
    ('00000000-0000-4000-8000-00000000a204', 'payroll_admin', v_sa);

  perform set_config('test.nx005', (select id::text from public.employees where employee_code = 'NX005'), true);
  perform set_config('test.nx004', (select id::text from public.employees where employee_code = 'NX004'), true);
  perform set_config('test.nx009', (select id::text from public.employees where employee_code = 'NX009'), true);
end
$$;

-- 1. employee and hr_admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a201","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.payroll_create_run('T210 X', date '2026-12-01', date '2026-12-31', null, null);
    raise exception 'FAIL: 1: employee created a payroll run';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You do not have permission%' then raise exception 'FAIL: 1: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform * from public.payroll_list_runs();
    raise exception 'FAIL: 1: employee listed payroll runs';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform count(*) from public.payroll_runs;
    raise exception 'FAIL: 9: employee queried payroll_runs';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a203","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform * from public.payroll_list_runs();
    raise exception 'FAIL: 1: hr_admin listed payroll runs';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.payroll_upsert_item((select gen_random_uuid()), current_setting('test.nx005')::uuid,
                                       1, 0, 0, 0, 0, 0, 0, 0, false);
    raise exception 'FAIL: 1: hr_admin saved a payroll item';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You do not have permission%' then raise exception 'FAIL: 1: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform count(*) from public.payroll_items;
    raise exception 'FAIL: 9: hr_admin queried payroll_items';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 2–6. payroll_admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a204","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_run uuid;
  v_empty uuid;
  v_item uuid;
  r record;
begin
  v_run := public.payroll_create_run('T210 December 2026', date '2026-12-01', date '2026-12-31', date '2027-01-01', 'test');
  perform set_config('test.run', v_run::text, true);

  -- 5. empty run cannot be submitted; invalid jump rejected
  v_empty := public.payroll_create_run('T210 Empty', date '2026-11-01', date '2026-11-30', null, null);
  perform public.payroll_set_run_status(v_empty, 'PROCESSING');
  begin
    perform public.payroll_set_run_status(v_empty, 'PENDING_APPROVAL');
    raise exception 'FAIL: 5: empty run submitted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Add at least one payroll item%' then raise exception 'FAIL: 5: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.payroll_set_run_status(v_run, 'APPROVED');
    raise exception 'FAIL: 5: DRAFT → APPROVED accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'A run cannot move from DRAFT to APPROVED%' then raise exception 'FAIL: 5: unexpected: %', sqlerrm; end if;
  end;

  -- 2. totals computed server-side
  v_item := public.payroll_upsert_item(v_run, current_setting('test.nx005')::uuid,
                                       40000, 16000, 9000, 1800, 0, 200, 3000, 0, false);
  select * into r from public.payroll_list_items(v_run) where id = v_item;
  if r.gross_earnings <> 65000 or r.total_deductions <> 5000 or r.net_pay <> 60000 then
    raise exception 'FAIL: 2: totals wrong (% / % / %)', r.gross_earnings, r.total_deductions, r.net_pay;
  end if;
  perform set_config('test.item5', v_item::text, true);
  -- A test-data item for NX004 (must never reach the employee).
  v_item := public.payroll_upsert_item(v_run, current_setting('test.nx004')::uuid,
                                       10000, 0, 0, 0, 0, 0, 0, 0, true);
  perform set_config('test.item4', v_item::text, true);

  -- 3. invalid amounts
  begin
    perform public.payroll_upsert_item(v_run, current_setting('test.nx005')::uuid, -1, 0, 0, 0, 0, 0, 0, 0, false);
    raise exception 'FAIL: 3: negative amount accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.payroll_upsert_item(v_run, current_setting('test.nx005')::uuid, 100, 0, 0, 200, 0, 0, 0, 0, false);
    raise exception 'FAIL: 3: deductions above gross accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Total deductions cannot exceed gross earnings%' then raise exception 'FAIL: 3: unexpected: %', sqlerrm; end if;
  end;

  -- 4. own item
  begin
    perform public.payroll_upsert_item(v_run, current_setting('test.nx009')::uuid, 1, 0, 0, 0, 0, 0, 0, 0, false);
    raise exception 'FAIL: 4: payroll_admin entered own item';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'You cannot enter your own payroll item%' then raise exception 'FAIL: 4: unexpected: %', sqlerrm; end if;
  end;

  -- 6. lock after submission
  perform public.payroll_set_run_status(v_run, 'PROCESSING');
  perform public.payroll_set_run_status(v_run, 'PENDING_APPROVAL');
  begin
    perform public.payroll_upsert_item(v_run, current_setting('test.nx005')::uuid, 1, 0, 0, 0, 0, 0, 0, 0, false);
    raise exception 'FAIL: 6: item changed while pending approval';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Items can only be changed while the run is draft or processing%' then raise exception 'FAIL: 6: unexpected: %', sqlerrm; end if;
  end;
  begin
    perform public.payroll_delete_item(current_setting('test.item5')::uuid);
    raise exception 'FAIL: 6: item deleted while pending approval';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform count(*) from public.payroll_items;
    raise exception 'FAIL: 9: payroll_admin queried payroll_items directly';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 7. Before approval: nothing visible to the employee
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a201","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.my_payslips() where id = current_setting('test.item5')::uuid) then
    raise exception 'FAIL: 7: payslip visible before approval';
  end if;
  begin
    perform public.my_payslip(current_setting('test.item5')::uuid);
    raise exception 'FAIL: 7: payslip detail visible before approval';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

-- Approve
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a204","role":"authenticated"}', true);
set local role authenticated;
do $$ begin perform public.payroll_set_run_status(current_setting('test.run')::uuid, 'APPROVED'); end $$;
reset role;

-- 7. After approval: own visible, not others', not test data
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a201","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v jsonb;
begin
  if not exists (select 1 from public.my_payslips() where id = current_setting('test.item5')::uuid) then
    raise exception 'FAIL: 7: own approved payslip not visible';
  end if;
  v := public.my_payslip(current_setting('test.item5')::uuid);
  if (v ->> 'net_pay')::numeric <> 60000 or v ->> 'employee_code' <> 'NX005' then
    raise exception 'FAIL: 7: payslip detail wrong: %', v;
  end if;
  begin
    perform public.my_payslip(current_setting('test.item4')::uuid);
    raise exception 'FAIL: 7: other employee''s payslip visible';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Payslip not found%' then raise exception 'FAIL: 7: unexpected: %', sqlerrm; end if;
  end;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a202","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.my_payslips() where id = current_setting('test.item4')::uuid) then
    raise exception 'FAIL: 7: test-data item visible to the employee';
  end if;
  if exists (select 1 from public.my_payslips() where id = current_setting('test.item5')::uuid) then
    raise exception 'FAIL: 7: another employee''s payslip listed';
  end if;
end
$$;
reset role;

-- 8. PAID
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a204","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.payroll_set_run_status(current_setting('test.run')::uuid, 'PAID');
  begin
    perform public.payroll_set_run_status(current_setting('test.run')::uuid, 'CANCELLED');
    raise exception 'FAIL: 8: paid run cancelled';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$$;
reset role;

do $$
begin
  if (select approved_by from public.payroll_runs where id = current_setting('test.run')::uuid)
     <> '00000000-0000-4000-8000-00000000a204'
     or (select paid_at from public.payroll_runs where id = current_setting('test.run')::uuid) is null then
    raise exception 'FAIL: 8: approved_by / paid_at not recorded';
  end if;
  -- 9. constraints hold even for the table owner
  begin
    update public.payroll_items set net_pay = net_pay + 1 where id = current_setting('test.item5')::uuid;
    raise exception 'FAIL: 9: inconsistent totals accepted';
  exception when check_violation then null;
  end;
end
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a201","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.my_payslips() where id = current_setting('test.item5')::uuid and run_status = 'PAID') then
    raise exception 'FAIL: 8: payslip not visible after PAID';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform * from public.my_payslips();
  raise exception 'FAIL: 9: anon executed my_payslips';
exception when insufficient_privilege then null;
end
$$;
reset role;

select 'ALL TESTS PASSED' as result;

rollback;
