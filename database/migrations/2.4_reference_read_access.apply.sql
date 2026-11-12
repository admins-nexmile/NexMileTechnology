-- =====================================================================
-- Nexmile HRMS — Migration 2.4: reference-table read access
-- =====================================================================
-- STATUS: APPLIED to nexmile-hrms-dev on 2026-11-12 (manually, SQL Editor) and verified
--         by database/tests/2.3_2.4_access_tests.sql (ALL TESTS PASSED).
-- Target:   Supabase project nexmile-hrms-dev.
-- Requires: 2.1 applied (2.3 not required).
-- Rollback: database/migrations/2.4_reference_read_access.rollback.sql
--
-- What this does
--   * app_private.is_active_user(): caller has an ACTIVE profile and at
--     least one role (same rule the app uses to admit a user).
--   * SELECT-only RLS policies, for active users, on:
--       public.departments, public.leave_types, public.holidays
--   * public.get_company_settings(): returns ONLY company_name, website,
--     country, currency and timezone as JSON, for active users.
--     admin_email, created_at and updated_at are never returned.
--     company_settings itself gets NO policy and stays locked.
--
-- What this does NOT do
--   * No INSERT/UPDATE/DELETE policies anywhere.
--   * No grant changes: authenticated must already hold SELECT on the
--     three tables (checked below). anon still matches no policy.
--   * Does not touch RLS on any other table.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if to_regprocedure('app_private.has_permission(text)') is null then
    raise exception '2.4 aborted: migration 2.1 not found';
  end if;
  if to_regprocedure('app_private.is_active_user()') is not null then
    raise exception '2.4 aborted: 2.4 objects already exist';
  end if;

  foreach t in array array['departments', 'leave_types', 'holidays', 'company_settings']
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise exception '2.4 aborted: public.% not found', t;
    end if;
    if not (select relrowsecurity from pg_class
            where oid = to_regclass(format('public.%I', t))) then
      raise exception '2.4 aborted: RLS is not enabled on public.%', t;
    end if;
  end loop;

  if exists (
    select 1
    from unnest(array['company_name', 'website', 'country', 'currency', 'timezone']) as c(name)
    where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'company_settings'
                        and column_name = c.name)
  ) then
    raise exception '2.4 aborted: public.company_settings is missing an expected column';
  end if;

  foreach t in array array['departments', 'leave_types', 'holidays']
  loop
    if not has_table_privilege('authenticated', format('public.%I', t), 'SELECT') then
      raise exception '2.4 aborted: authenticated lacks SELECT on public.%', t;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Helper
-- ---------------------------------------------------------------------
create function app_private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

revoke all on function app_private.is_active_user() from public, anon, service_role;
grant execute on function app_private.is_active_user() to authenticated;

-- ---------------------------------------------------------------------
-- 2. SELECT-only policies on reference tables
-- ---------------------------------------------------------------------
create policy departments_select_active on public.departments
  for select to authenticated
  using ((select app_private.is_active_user()));

create policy leave_types_select_active on public.leave_types
  for select to authenticated
  using ((select app_private.is_active_user()));

create policy holidays_select_active on public.holidays
  for select to authenticated
  using ((select app_private.is_active_user()));

-- ---------------------------------------------------------------------
-- 3. Non-sensitive company settings
-- ---------------------------------------------------------------------
create function app_private.get_company_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows   integer;
  v_result jsonb;
begin
  if not app_private.is_active_user() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select count(*) into v_rows from public.company_settings;
  if v_rows > 1 then
    raise exception 'company_settings has % rows; expected at most one', v_rows;
  end if;

  -- Explicit column list: admin_email, created_at and updated_at are
  -- deliberately excluded.
  select pg_catalog.jsonb_build_object(
           'company_name', cs.company_name,
           'website',      cs.website,
           'country',      cs.country,
           'currency',     cs.currency,
           'timezone',     cs.timezone)
    into v_result
  from public.company_settings cs;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create function public.get_company_settings()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select app_private.get_company_settings(); $$;

revoke all on function app_private.get_company_settings() from public, anon, service_role;
grant execute on function app_private.get_company_settings() to authenticated;
revoke all on function public.get_company_settings() from public, anon, service_role;
grant execute on function public.get_company_settings() to authenticated;

commit;
