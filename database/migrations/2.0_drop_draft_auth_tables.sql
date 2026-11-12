-- =====================================================================
-- Nexmile HRMS — Migration 2.0: drop empty draft auth tables
-- =====================================================================
-- STATUS: APPLIED to nexmile-hrms-dev on 2026-11-12 (manually, SQL Editor) and verified.
-- Target:  Supabase project nexmile-hrms-dev.
-- Must run BEFORE 2.1_auth_foundation.apply.sql.
--
-- Drops these draft tables, which were reported to have zero rows and
-- no RLS policies:
--   public.invitations, public.user_roles, public.role_permissions,
--   public.profiles
--
-- Safety
--   * Single transaction: any failed check aborts everything.
--   * Each table is locked (ACCESS EXCLUSIVE) BEFORE its row check, so no
--     row can be inserted between the check and the drop.
--   * Raises an exception if a table is missing or contains any row.
--   * Raises an exception if a trigger on auth.users calls a function
--     that references these tables (sign-ups would break once they are
--     gone). Remove or replace such a trigger first.
--   * Plain DROP TABLE (no CASCADE): fails if any view, foreign key
--     (e.g. from employee_compensation) or other object depends on them.
--   * public.employee_compensation and the original 14 tables are NOT
--     dropped or modified.
--
-- Irreversible: there is no rollback file because the draft definitions
-- are not stored in this repository. Keep the exported draft schema if
-- you may need to recreate them.
-- =====================================================================

begin;

-- 1. Lock and verify each draft table is present and empty.
do $$
declare
  t text;
  has_rows boolean;
begin
  foreach t in array array['invitations', 'user_roles', 'role_permissions', 'profiles']
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise exception '2.0 aborted: table public.% does not exist', t;
    end if;

    if exists (select 1 from pg_catalog.pg_class c
               where c.oid = to_regclass(format('public.%I', t))
                 and c.relkind <> 'r') then
      raise exception '2.0 aborted: public.% is not an ordinary table', t;
    end if;

    execute format('lock table public.%I in access exclusive mode', t);

    execute format('select exists (select 1 from public.%I)', t) into has_rows;
    if has_rows then
      raise exception '2.0 aborted: public.% is not empty', t;
    end if;
  end loop;
end
$$;

-- 2. Refuse to continue if an auth.users trigger writes to these tables.
do $$
declare
  offending text;
begin
  select string_agg(format('%s -> %s', t.tgname, t.tgfoid::regprocedure), ', ')
    into offending
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.users'::regclass
    and not t.tgisinternal
    and p.prosrc ~* '\m(profiles|user_roles|role_permissions|invitations)\M';

  if offending is not null then
    raise exception '2.0 aborted: auth.users trigger(s) reference draft tables: %', offending;
  end if;
end
$$;

-- 3. Report (but do not block on) other functions that mention these
--    tables; they would fail at runtime until 2.1 recreates the tables.
do $$
declare
  fn text;
begin
  for fn in
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage',
                            'realtime', 'extensions', 'graphql', 'graphql_public',
                            'vault', 'pgsodium', 'net', 'supabase_functions')
      and p.prosrc ~* '\m(profiles|user_roles|role_permissions|invitations)\M'
  loop
    raise notice '2.0: function % references a dropped draft table; review it', fn;
  end loop;
end
$$;

-- 4. Drop (children first; no CASCADE).
drop table public.invitations;
drop table public.user_roles;
drop table public.role_permissions;
drop table public.profiles;

commit;
