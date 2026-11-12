-- =====================================================================
-- Nexmile HRMS â€” Migration 2.10: payroll workflow and own payslips
-- =====================================================================
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.9 applied.
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_10_payroll_workflow); tests ALL TESTS PASSED.
-- Rollback: database/migrations/2.10_payroll_workflow.rollback.sql
-- Test:     database/tests/2.10_payroll_workflow_tests.sql
--
-- Applied through Supabase MCP apply_migration (one transaction).
--
-- IMPORTANT: this is a record-keeping workflow. Amounts are entered by
-- Payroll; nothing here calculates Indian statutory deductions (PF, ESI,
-- PT, TDS). It is not a production payroll engine.
--
-- Tables
--   * payroll_runs: adds approved_by (auth user) and paid_at.
--   * payroll_items: adds CHECK constraints so stored totals are always
--     consistent (gross = basic + HRA + other; total deductions = sum of
--     deductions; net = gross âˆ’ total deductions; every amount >= 0).
--     Existing rows were verified consistent before this migration.
--   * Both tables stay locked: no policies, no table privileges for API
--     roles. All access is through the functions below.
--
-- payroll.manage (Payroll Admin, Super Admin):
--   payroll_create_run / payroll_update_run (DRAFT or PROCESSING only)
--   payroll_set_run_status   DRAFT â†’ PROCESSING â†’ PENDING_APPROVAL â†’
--                            APPROVED â†’ PAID; PROCESSING â†” DRAFT and
--                            PENDING_APPROVAL â†’ PROCESSING (send back);
--                            CANCELLED from any status before APPROVED.
--                            Submitting needs â‰¥ 1 item.
--   payroll_upsert_item / payroll_delete_item  DRAFT or PROCESSING only;
--                            totals computed here; never your own item.
-- payroll.read:
--   payroll_list_runs(), payroll_list_items(run)
-- Any active employee (own data only):
--   my_payslips(), my_payslip(id): items of APPROVED or PAID runs with
--   is_test_data = false.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.admin_create_employee(jsonb)') is null then
    raise exception '2.10 aborted: migration 2.9 not found';
  end if;
  if to_regprocedure('app_private.payroll_create_run(text,date,date,date,text)') is not null then
    raise exception '2.10 aborted: 2.10 objects already exist';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and table_name = 'payroll_runs' and column_name in ('approved_by', 'paid_at')) then
    raise exception '2.10 aborted: payroll_runs already has approved_by / paid_at';
  end if;
  if exists (select 1 from public.payroll_items
             where gross_earnings <> basic_salary + hra + other_allowances
                or total_deductions <> pf_deduction + esi_deduction + professional_tax
                                       + tds_deduction + other_deductions
                or net_pay <> gross_earnings - total_deductions
                or least(basic_salary, hra, other_allowances, pf_deduction, esi_deduction,
                         professional_tax, tds_deduction, other_deductions) < 0) then
    raise exception '2.10 aborted: existing payroll_items have inconsistent totals';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename in ('payroll_runs', 'payroll_items')) then
    raise exception '2.10 aborted: payroll tables unexpectedly have policies';
  end if;
  if has_table_privilege('authenticated', 'public.payroll_items', 'SELECT')
     or has_table_privilege('anon', 'public.payroll_items', 'SELECT') then
    raise exception '2.10 aborted: payroll_items is readable by an API role';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Schema additions (non-destructive)
-- ---------------------------------------------------------------------
alter table public.payroll_runs
  add column approved_by uuid references auth.users (id) on delete set null,
  add column paid_at timestamptz;
create index payroll_runs_approved_by_idx on public.payroll_runs (approved_by);

alter table public.payroll_items
  add constraint payroll_items_amounts_non_negative check (
    basic_salary >= 0 and hra >= 0 and other_allowances >= 0 and pf_deduction >= 0
    and esi_deduction >= 0 and professional_tax >= 0 and tds_deduction >= 0
    and other_deductions >= 0),
  add constraint payroll_items_totals_consistent check (
    gross_earnings = basic_salary + hra + other_allowances
    and total_deductions = pf_deduction + esi_deduction + professional_tax
                           + tds_deduction + other_deductions
    and net_pay = gross_earnings - total_deductions);

-- ---------------------------------------------------------------------
-- 2. Runs
-- ---------------------------------------------------------------------
create function app_private.payroll_create_run(
  p_period_name text, p_start date, p_end date, p_pay_date date, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := app_private.clean_text(p_period_name, 50, 'Period name', true);
  v_id   uuid;
begin
  perform app_private.require_permission('payroll.manage');
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Enter a valid period (end on or after start).';
  end if;
  if p_pay_date is not null and p_pay_date < p_start then
    raise exception 'The pay date cannot be before the period starts.';
  end if;
  if exists (select 1 from public.payroll_runs where lower(period_name) = lower(v_name)) then
    raise exception 'A payroll run named % already exists.', v_name;
  end if;
  insert into public.payroll_runs (period_name, period_start, period_end, pay_date, notes, status)
  values (v_name, p_start, p_end, p_pay_date,
          app_private.clean_text(p_notes, 500, 'Notes', false), 'DRAFT')
  returning id into v_id;
  perform app_private.write_audit('payroll_run_created', 'payroll_run', v_id,
    pg_catalog.jsonb_build_object('period_name', v_name));
  return v_id;
end;
$$;

create function app_private.payroll_update_run(
  p_id uuid, p_period_name text, p_start date, p_end date, p_pay_date date, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := app_private.clean_text(p_period_name, 50, 'Period name', true);
  v_status text;
begin
  perform app_private.require_permission('payroll.manage');
  select status into v_status from public.payroll_runs where id = p_id for update;
  if not found then
    raise exception 'Payroll run not found.';
  end if;
  if v_status not in ('DRAFT', 'PROCESSING') then
    raise exception 'Only draft or processing runs can be edited.';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Enter a valid period (end on or after start).';
  end if;
  if p_pay_date is not null and p_pay_date < p_start then
    raise exception 'The pay date cannot be before the period starts.';
  end if;
  if exists (select 1 from public.payroll_runs where lower(period_name) = lower(v_name) and id <> p_id) then
    raise exception 'A payroll run named % already exists.', v_name;
  end if;
  update public.payroll_runs
     set period_name = v_name, period_start = p_start, period_end = p_end,
         pay_date = p_pay_date, notes = app_private.clean_text(p_notes, 500, 'Notes', false)
   where id = p_id;
  perform app_private.write_audit('payroll_run_updated', 'payroll_run', p_id,
    pg_catalog.jsonb_build_object('period_name', v_name));
end;
$$;

create function app_private.payroll_set_run_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_permission('payroll.manage');
  v_run public.payroll_runs%rowtype;
  v_ok  boolean;
begin
  select * into v_run from public.payroll_runs where id = p_id for update;
  if not found then
    raise exception 'Payroll run not found.';
  end if;

  v_ok := (v_run.status, p_status) in (
    ('DRAFT', 'PROCESSING'),
    ('PROCESSING', 'DRAFT'),
    ('PROCESSING', 'PENDING_APPROVAL'),
    ('PENDING_APPROVAL', 'PROCESSING'),
    ('PENDING_APPROVAL', 'APPROVED'),
    ('APPROVED', 'PAID'),
    ('DRAFT', 'CANCELLED'),
    ('PROCESSING', 'CANCELLED'),
    ('PENDING_APPROVAL', 'CANCELLED'));
  if not coalesce(v_ok, false) then
    raise exception 'A run cannot move from % to %.', v_run.status, coalesce(p_status, 'nothing');
  end if;

  if p_status = 'PENDING_APPROVAL'
     and not exists (select 1 from public.payroll_items where payroll_run_id = p_id) then
    raise exception 'Add at least one payroll item before submitting for approval.';
  end if;

  update public.payroll_runs
     set status      = p_status,
         approved_at = case when p_status = 'APPROVED' then now()
                            when p_status in ('PROCESSING', 'DRAFT') then null
                            else approved_at end,
         approved_by = case when p_status = 'APPROVED' then v_uid
                            when p_status in ('PROCESSING', 'DRAFT') then null
                            else approved_by end,
         paid_at     = case when p_status = 'PAID' then now() else paid_at end
   where id = p_id;

  perform app_private.write_audit('payroll_run_status_set', 'payroll_run', p_id,
    pg_catalog.jsonb_build_object('from', v_run.status, 'to', p_status));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Items
-- ---------------------------------------------------------------------
create function app_private.payroll_upsert_item(
  p_run_id uuid, p_employee_id uuid,
  p_basic numeric, p_hra numeric, p_other_allowances numeric,
  p_pf numeric, p_esi numeric, p_pt numeric, p_tds numeric, p_other_deductions numeric,
  p_is_test_data boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_gross  numeric;
  v_ded    numeric;
  v_net    numeric;
  v_id     uuid;
  v_amount numeric;
begin
  perform app_private.require_permission('payroll.manage');
  if p_employee_id is not null and p_employee_id = app_private.my_employee_id() then
    raise exception 'You cannot enter your own payroll item.' using errcode = '42501';
  end if;

  select status into v_status from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run not found.';
  end if;
  if v_status not in ('DRAFT', 'PROCESSING') then
    raise exception 'Items can only be changed while the run is draft or processing.';
  end if;
  if not exists (select 1 from public.employees where id = p_employee_id) then
    raise exception 'Employee not found.';
  end if;

  foreach v_amount in array array[p_basic, p_hra, p_other_allowances, p_pf, p_esi, p_pt, p_tds, p_other_deductions] loop
    if v_amount is null or v_amount < 0 or v_amount > 100000000 or v_amount <> round(v_amount, 2) then
      raise exception 'Every amount must be between 0 and 10,00,00,000 with at most two decimals.';
    end if;
  end loop;

  v_gross := p_basic + p_hra + p_other_allowances;
  v_ded   := p_pf + p_esi + p_pt + p_tds + p_other_deductions;
  v_net   := v_gross - v_ded;
  if v_net < 0 then
    raise exception 'Total deductions cannot exceed gross earnings.';
  end if;

  insert into public.payroll_items (
    payroll_run_id, employee_id, basic_salary, hra, other_allowances, gross_earnings,
    pf_deduction, esi_deduction, professional_tax, tds_deduction, other_deductions,
    total_deductions, net_pay, is_test_data)
  values (p_run_id, p_employee_id, p_basic, p_hra, p_other_allowances, v_gross,
          p_pf, p_esi, p_pt, p_tds, p_other_deductions, v_ded, v_net,
          coalesce(p_is_test_data, true))
  on conflict (payroll_run_id, employee_id) do update set
    basic_salary = excluded.basic_salary, hra = excluded.hra,
    other_allowances = excluded.other_allowances, gross_earnings = excluded.gross_earnings,
    pf_deduction = excluded.pf_deduction, esi_deduction = excluded.esi_deduction,
    professional_tax = excluded.professional_tax, tds_deduction = excluded.tds_deduction,
    other_deductions = excluded.other_deductions, total_deductions = excluded.total_deductions,
    net_pay = excluded.net_pay, is_test_data = excluded.is_test_data
  returning id into v_id;

  perform app_private.write_audit('payroll_item_saved', 'payroll_item', v_id,
    pg_catalog.jsonb_build_object('run_id', p_run_id, 'employee_id', p_employee_id,
                                  'net_pay', v_net, 'is_test_data', coalesce(p_is_test_data, true)));
  return v_id;
end;
$$;

create function app_private.payroll_delete_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.payroll_items%rowtype;
  v_status text;
begin
  perform app_private.require_permission('payroll.manage');
  select * into v_item from public.payroll_items where id = p_id for update;
  if not found then
    raise exception 'Payroll item not found.';
  end if;
  select status into v_status from public.payroll_runs where id = v_item.payroll_run_id for update;
  if v_status not in ('DRAFT', 'PROCESSING') then
    raise exception 'Items can only be changed while the run is draft or processing.';
  end if;
  if v_item.employee_id = app_private.my_employee_id() then
    raise exception 'You cannot change your own payroll item.' using errcode = '42501';
  end if;
  delete from public.payroll_items where id = p_id;
  perform app_private.write_audit('payroll_item_deleted', 'payroll_item', p_id,
    pg_catalog.jsonb_build_object('run_id', v_item.payroll_run_id, 'employee_id', v_item.employee_id));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Reads
-- ---------------------------------------------------------------------
create function app_private.payroll_list_runs()
returns table (
  id uuid, period_name text, period_start date, period_end date, pay_date date,
  status text, notes text, created_at timestamptz, approved_at timestamptz, paid_at timestamptz,
  item_count bigint, test_item_count bigint, total_gross numeric, total_net numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_permission('payroll.read');
  return query
  select r.id, r.period_name, r.period_start, r.period_end, r.pay_date, r.status, r.notes,
         r.created_at, r.approved_at, r.paid_at,
         count(i.id), count(i.id) filter (where i.is_test_data),
         coalesce(sum(i.gross_earnings), 0), coalesce(sum(i.net_pay), 0)
  from public.payroll_runs r
  left join public.payroll_items i on i.payroll_run_id = r.id
  group by r.id
  order by r.period_start desc;
end;
$$;

create function app_private.payroll_list_items(p_run_id uuid)
returns table (
  id uuid, employee_id uuid, employee_code text, employee_name text,
  basic_salary numeric, hra numeric, other_allowances numeric, gross_earnings numeric,
  pf_deduction numeric, esi_deduction numeric, professional_tax numeric, tds_deduction numeric,
  other_deductions numeric, total_deductions numeric, net_pay numeric, is_test_data boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_permission('payroll.read');
  return query
  select i.id, i.employee_id, e.employee_code,
         app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
         i.basic_salary, i.hra, i.other_allowances, i.gross_earnings,
         i.pf_deduction, i.esi_deduction, i.professional_tax, i.tds_deduction,
         i.other_deductions, i.total_deductions, i.net_pay, i.is_test_data
  from public.payroll_items i
  join public.employees e on e.id = i.employee_id
  where i.payroll_run_id = p_run_id
  order by e.employee_code;
end;
$$;

create function app_private.my_payslips()
returns table (
  id uuid, period_name text, period_start date, period_end date, pay_date date,
  run_status text, gross_earnings numeric, total_deductions numeric, net_pay numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := app_private.require_my_employee();
begin
  return query
  select i.id, r.period_name, r.period_start, r.period_end, r.pay_date, r.status,
         i.gross_earnings, i.total_deductions, i.net_pay
  from public.payroll_items i
  join public.payroll_runs r on r.id = i.payroll_run_id
  where i.employee_id = v_me
    and r.status in ('APPROVED', 'PAID')
    and not i.is_test_data
  order by r.period_start desc;
end;
$$;

create function app_private.my_payslip(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me     uuid := app_private.require_my_employee();
  v_result jsonb;
begin
  select pg_catalog.jsonb_build_object(
           'id', i.id,
           'period_name', r.period_name, 'period_start', r.period_start,
           'period_end', r.period_end, 'pay_date', r.pay_date, 'run_status', r.status,
           'employee_code', e.employee_code,
           'employee_name', app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
           'designation', e.designation, 'department', d.name, 'work_location', e.work_location,
           'company_name', (select cs.company_name from public.company_settings cs limit 1),
           'basic_salary', i.basic_salary, 'hra', i.hra, 'other_allowances', i.other_allowances,
           'gross_earnings', i.gross_earnings,
           'pf_deduction', i.pf_deduction, 'esi_deduction', i.esi_deduction,
           'professional_tax', i.professional_tax, 'tds_deduction', i.tds_deduction,
           'other_deductions', i.other_deductions, 'total_deductions', i.total_deductions,
           'net_pay', i.net_pay)
    into v_result
  from public.payroll_items i
  join public.payroll_runs r on r.id = i.payroll_run_id
  join public.employees e on e.id = i.employee_id
  left join public.departments d on d.id = e.department_id
  where i.id = p_id
    and i.employee_id = v_me
    and r.status in ('APPROVED', 'PAID')
    and not i.is_test_data;
  if v_result is null then
    raise exception 'Payslip not found.';
  end if;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Public wrappers and privileges
-- ---------------------------------------------------------------------
create function public.payroll_create_run(p_period_name text, p_start date, p_end date, p_pay_date date, p_notes text) returns uuid
language sql security invoker set search_path = '' as $$ select app_private.payroll_create_run(p_period_name, p_start, p_end, p_pay_date, p_notes); $$;
create function public.payroll_update_run(p_id uuid, p_period_name text, p_start date, p_end date, p_pay_date date, p_notes text) returns void
language sql security invoker set search_path = '' as $$ select app_private.payroll_update_run(p_id, p_period_name, p_start, p_end, p_pay_date, p_notes); $$;
create function public.payroll_set_run_status(p_id uuid, p_status text) returns void
language sql security invoker set search_path = '' as $$ select app_private.payroll_set_run_status(p_id, p_status); $$;
create function public.payroll_upsert_item(
  p_run_id uuid, p_employee_id uuid, p_basic numeric, p_hra numeric, p_other_allowances numeric,
  p_pf numeric, p_esi numeric, p_pt numeric, p_tds numeric, p_other_deductions numeric, p_is_test_data boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select app_private.payroll_upsert_item(p_run_id, p_employee_id, p_basic, p_hra, p_other_allowances,
                                         p_pf, p_esi, p_pt, p_tds, p_other_deductions, p_is_test_data); $$;
create function public.payroll_delete_item(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select app_private.payroll_delete_item(p_id); $$;
create function public.payroll_list_runs()
returns table (id uuid, period_name text, period_start date, period_end date, pay_date date,
               status text, notes text, created_at timestamptz, approved_at timestamptz, paid_at timestamptz,
               item_count bigint, test_item_count bigint, total_gross numeric, total_net numeric)
language sql stable security invoker set search_path = '' as $$ select * from app_private.payroll_list_runs(); $$;
create function public.payroll_list_items(p_run_id uuid)
returns table (id uuid, employee_id uuid, employee_code text, employee_name text,
               basic_salary numeric, hra numeric, other_allowances numeric, gross_earnings numeric,
               pf_deduction numeric, esi_deduction numeric, professional_tax numeric, tds_deduction numeric,
               other_deductions numeric, total_deductions numeric, net_pay numeric, is_test_data boolean)
language sql stable security invoker set search_path = '' as $$ select * from app_private.payroll_list_items(p_run_id); $$;
create function public.my_payslips()
returns table (id uuid, period_name text, period_start date, period_end date, pay_date date,
               run_status text, gross_earnings numeric, total_deductions numeric, net_pay numeric)
language sql stable security invoker set search_path = '' as $$ select * from app_private.my_payslips(); $$;
create function public.my_payslip(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select app_private.my_payslip(p_id); $$;

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
    execute format('revoke all on function app_private.%s from public, anon, service_role', f);
    execute format('grant execute on function app_private.%s to authenticated', f);
    execute format('revoke all on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

commit;
