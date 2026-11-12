-- =====================================================================
-- Nexmile HRMS â€” Migration 2.12: final security hardening + audit viewer
-- =====================================================================
-- Target:   Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv).
-- Requires: 2.11 applied.
-- STATUS: APPLIED 2026-11-12 via Supabase MCP (migration 2_12_security_hardening); tests ALL TESTS PASSED.
-- Rollback: database/migrations/2.12_security_hardening.rollback.sql
-- Test:     database/tests/2.12_security_hardening_tests.sql
--
-- Applied through Supabase MCP apply_migration (one transaction).
--
-- Advisor fixes
--   * public.rls_auto_enable() (event-trigger function that turns on RLS
--     for new public tables) was executable by anon and authenticated via
--     /rest/v1/rpc. EXECUTE is revoked from public, anon and authenticated;
--     the event trigger itself keeps working (tested).
--   * profiles and user_roles each had two permissive SELECT policies.
--     They are merged into one policy per table with the same rule:
--       profiles:   own row OR users.read
--       user_roles: own rows OR roles.manage
--
-- Defaults for future objects (created by role postgres)
--   * schema public: anon no longer gets functions, tables or sequences
--     by default;
--   * all schemas: PUBLIC no longer gets EXECUTE on new functions.
--   Every migration still grants explicitly.
--
-- Audit-log viewer (super_admin role only)
--   * audit_list(limit, offset, action)  newest first, with actor
--   * audit_actions()                    distinct action names
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.doc_register(uuid,text,text,text,boolean)') is null then
    raise exception '2.12 aborted: migration 2.11 not found';
  end if;
  if to_regprocedure('app_private.audit_list(integer,integer,text)') is not null then
    raise exception '2.12 aborted: 2.12 objects already exist';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is null then
    raise exception '2.12 aborted: public.rls_auto_enable() not found';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
      and policyname in ('profiles_select_own', 'profiles_select_admin',
                         'user_roles_select_own', 'user_roles_select_admin')) <> 4 then
    raise exception '2.12 aborted: expected 2.1 profiles / user_roles policies not found';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) then
    raise exception '2.12 aborted: a public table has RLS disabled';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. rls_auto_enable: not callable through the API
-- ---------------------------------------------------------------------
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. One SELECT policy per table on profiles and user_roles
-- ---------------------------------------------------------------------
drop policy profiles_select_own   on public.profiles;
drop policy profiles_select_admin on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select app_private.has_permission('users.read')));

drop policy user_roles_select_own   on public.user_roles;
drop policy user_roles_select_admin on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select app_private.has_permission('roles.manage')));

-- ---------------------------------------------------------------------
-- 3. Safer defaults for future objects in public
-- ---------------------------------------------------------------------
-- Schema-level entries (found: anon had X on functions, arwdDxtm on
-- tables, rwU on sequences):
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
-- PUBLIC's EXECUTE on new functions comes from the global default, which a
-- schema-level REVOKE cannot remove, so revoke it globally for postgres.
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- 4. Audit-log viewer (super_admin)
-- ---------------------------------------------------------------------
create function app_private.audit_list(p_limit integer, p_offset integer, p_action text)
returns table (
  id uuid, created_at timestamptz, action text, entity_type text, entity_id uuid,
  details jsonb, actor_email text, actor_employee_code text, actor_employee_name text,
  total_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_action text := nullif(pg_catalog.btrim(p_action), '');
begin
  if not app_private.has_role('super_admin') then
    raise exception 'You do not have permission to do that.' using errcode = '42501';
  end if;
  return query
  select a.id, a.created_at, a.action, a.entity_type, a.entity_id, a.details,
         p.email,
         e.employee_code,
         app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
         count(*) over ()
  from public.audit_logs a
  left join public.profiles p on p.id::text = a.details ->> 'actor_user_id'
  left join public.employees e on e.id = a.actor_employee_id
  where v_action is null or a.action = v_action
  order by a.created_at desc, a.id
  limit v_limit offset v_offset;
end;
$$;

create function app_private.audit_actions()
returns table (action text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.has_role('super_admin') then
    raise exception 'You do not have permission to do that.' using errcode = '42501';
  end if;
  return query select distinct a.action from public.audit_logs a order by 1;
end;
$$;

create function public.audit_list(p_limit integer, p_offset integer, p_action text)
returns table (id uuid, created_at timestamptz, action text, entity_type text, entity_id uuid,
               details jsonb, actor_email text, actor_employee_code text, actor_employee_name text,
               total_count bigint)
language sql stable security invoker set search_path = ''
as $$ select * from app_private.audit_list(p_limit, p_offset, p_action); $$;

create function public.audit_actions()
returns table (action text)
language sql stable security invoker set search_path = ''
as $$ select * from app_private.audit_actions(); $$;

revoke all on function app_private.audit_list(integer, integer, text) from public, anon, service_role;
revoke all on function app_private.audit_actions()                    from public, anon, service_role;
revoke all on function public.audit_list(integer, integer, text)      from public, anon, service_role;
revoke all on function public.audit_actions()                         from public, anon, service_role;
grant execute on function app_private.audit_list(integer, integer, text) to authenticated;
grant execute on function app_private.audit_actions()                    to authenticated;
grant execute on function public.audit_list(integer, integer, text)      to authenticated;
grant execute on function public.audit_actions()                         to authenticated;

-- audit_logs.created_at index for the viewer (exists in the original
-- schema as idx_audit_logs_created; verified, nothing to add).

commit;
