-- =====================================================================
-- Nexmile HRMS — Migration 2.2: Super Admin bootstrap, role guards, role audit
-- =====================================================================
-- STATUS: APPLIED to nexmile-hrms-dev on 2026-11-12 (manually, SQL Editor) and verified;
--         bootstrap run for admins@nexmiletechnology.com.
-- Target:   Supabase project nexmile-hrms-dev.
-- Requires: 2.1_auth_foundation.apply.sql applied.
-- Rollback: database/migrations/2.2_super_admin_bootstrap.rollback.sql
--
-- What this does
--   * app_private.bootstrap_super_admin(p_email): one-time promotion of a
--     verified Google user to super_admin. Executable by NO API role;
--     only the database owner (SQL Editor) can run it.
--   * Guard triggers: the last ACTIVE super_admin can neither lose the
--     role (delete/update on user_roles) nor have their profile set to
--     pending/suspended.
--   * Audit trigger: every insert/update/delete on user_roles writes a
--     row to public.audit_logs.
--
-- What this does NOT do
--   * Does not run the bootstrap. That is a separate manual statement.
--   * Creates no RLS policies and no client write access.
--   * Does not change any existing table's columns, data or RLS.
--
-- audit_logs assumptions (verified by the pre-flight block below):
--   action/entity_type text or varchar, entity_id uuid, details jsonb,
--   actor_employee_id uuid (nullable); no other NOT NULL column without
--   a default; and the table accepts the action values used here.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
declare
  col record;
  missing text;
  a text;
begin
  if to_regclass('public.user_roles') is null
     or to_regclass('public.profiles') is null
     or to_regnamespace('app_private') is null then
    raise exception '2.2 aborted: migration 2.1 objects not found';
  end if;

  if to_regprocedure('app_private.bootstrap_super_admin(text)') is not null then
    raise exception '2.2 aborted: app_private.bootstrap_super_admin already exists';
  end if;

  -- Required audit_logs columns and types.
  for col in
    select * from (values
      ('action',            array['text', 'character varying']),
      ('entity_type',       array['text', 'character varying']),
      ('entity_id',         array['uuid']),
      ('details',           array['jsonb']),
      ('actor_employee_id', array['uuid'])) as v(name, types)
  loop
    if not coalesce((select data_type = any (col.types)
                     from information_schema.columns
                     where table_schema = 'public' and table_name = 'audit_logs'
                       and column_name = col.name), false) then
      raise exception '2.2 aborted: public.audit_logs.% is missing or not one of %',
        col.name, col.types;
    end if;
  end loop;

  -- No other mandatory column we would fail to fill.
  select string_agg(column_name, ', ') into missing
  from information_schema.columns
  where table_schema = 'public' and table_name = 'audit_logs'
    and is_nullable = 'NO' and column_default is null
    and is_identity = 'NO' and is_generated = 'NEVER'
    and column_name not in ('action', 'entity_type', 'entity_id', 'details');
  if missing is not null then
    raise exception '2.2 aborted: audit_logs has other required columns: %', missing;
  end if;

  -- Prove audit_logs accepts each row shape (e.g. CHECK constraints on
  -- action/entity_type). Each test insert is undone by the exception
  -- handler's implicit savepoint, so nothing is persisted.
  foreach a in array array['bootstrap_super_admin', 'role_granted',
                           'role_revoked', 'role_changed']
  loop
    begin
      insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
      values (a, 'user', gen_random_uuid(), '{}'::jsonb, null);
      raise exception using errcode = 'P0001', message = '__2_2_probe_ok__';
    exception
      when others then
        if sqlerrm <> '__2_2_probe_ok__' then
          raise exception '2.2 aborted: audit_logs rejected action "%": %', a, sqlerrm;
        end if;
    end;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Shared helpers
-- ---------------------------------------------------------------------
-- Serialises every operation that can change the set of super admins,
-- so two concurrent revokes cannot both pass the "last one" check.
create function app_private.lock_super_admin_set()
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nexmile.super_admin_set'));
$$;

-- Number of ACTIVE super admins, optionally excluding one user.
create function app_private.active_super_admin_count(p_exclude uuid default null)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role_key = 'super_admin'
    and p.status = 'active'
    and (p_exclude is null or ur.user_id <> p_exclude);
$$;

-- ---------------------------------------------------------------------
-- 2. One-time Super Admin bootstrap
-- ---------------------------------------------------------------------
create function app_private.bootstrap_super_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email    text := lower(trim(p_email));
  v_user_id  uuid;
  v_matches  int;
  v_now      timestamptz := now();
begin
  if v_email is null or v_email = '' then
    raise exception 'bootstrap_super_admin: email is required';
  end if;

  perform app_private.lock_super_admin_set();

  -- One-time only: refuse if anyone (active or not) holds super_admin.
  if exists (select 1 from public.user_roles where role_key = 'super_admin') then
    raise exception 'bootstrap_super_admin: a super_admin already exists; bootstrap is one-time only';
  end if;

  -- Exactly one auth user with this email.
  select count(*) into v_matches
  from auth.users u
  where lower(u.email) = v_email;
  if v_matches <> 1 then
    raise exception 'bootstrap_super_admin: expected exactly 1 auth user for %, found %',
      v_email, v_matches;
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
    and u.email_confirmed_at is not null;
  if v_user_id is null then
    raise exception 'bootstrap_super_admin: email for % is not confirmed', v_email;
  end if;

  if not exists (select 1 from auth.identities i
                 where i.user_id = v_user_id and i.provider = 'google') then
    raise exception 'bootstrap_super_admin: % has no Google identity', v_email;
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'bootstrap_super_admin: no profile for %', v_email;
  end if;

  update public.profiles set status = 'active' where id = v_user_id;

  insert into public.user_roles (user_id, role_key, granted_by)
  values (v_user_id, 'super_admin', null);

  insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
  values ('bootstrap_super_admin', 'user', v_user_id,
          pg_catalog.jsonb_build_object('email', v_email, 'at', v_now),
          null);

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Guard: keep at least one active super_admin
-- ---------------------------------------------------------------------
create function app_private.guard_last_super_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removes_super_admin boolean := old.role_key = 'super_admin';
begin
  -- An UPDATE that keeps the same user as super_admin removes nothing.
  if v_removes_super_admin and tg_op = 'UPDATE' then
    if new.role_key = 'super_admin' and new.user_id = old.user_id then
      v_removes_super_admin := false;
    end if;
  end if;

  if v_removes_super_admin then
    perform app_private.lock_super_admin_set();

    if exists (select 1 from public.profiles
               where id = old.user_id and status = 'active')
       and app_private.active_super_admin_count(old.user_id) = 0 then
      raise exception 'Cannot remove the last active super_admin'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function app_private.guard_last_super_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status <> 'active'
     and exists (select 1 from public.user_roles
                 where user_id = old.id and role_key = 'super_admin') then
    perform app_private.lock_super_admin_set();
    if app_private.active_super_admin_count(old.id) = 0 then
      raise exception 'Cannot set the last active super_admin to %', new.status
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Audit every role grant / revoke / change
-- ---------------------------------------------------------------------
create function app_private.audit_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user     uuid := auth.uid();  -- NULL in the SQL Editor
  v_actor_employee uuid;
begin
  if v_actor_user is not null then
    select employee_id into v_actor_employee
    from public.profiles where id = v_actor_user;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
    values ('role_granted', 'user', new.user_id,
            pg_catalog.jsonb_build_object(
              'role', new.role_key, 'granted_by', new.granted_by,
              'actor_user_id', v_actor_user, 'at', now()),
            v_actor_employee);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
    values ('role_revoked', 'user', old.user_id,
            pg_catalog.jsonb_build_object(
              'role', old.role_key, 'actor_user_id', v_actor_user, 'at', now()),
            v_actor_employee);
    return old;
  else
    insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
    values ('role_changed', 'user', new.user_id,
            pg_catalog.jsonb_build_object(
              'old_user_id', old.user_id, 'old_role', old.role_key,
              'new_role', new.role_key, 'actor_user_id', v_actor_user, 'at', now()),
            v_actor_employee);
    return new;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Privileges: no API role may execute any of these functions
-- ---------------------------------------------------------------------
revoke all on function app_private.lock_super_admin_set()             from public, anon, authenticated, service_role;
revoke all on function app_private.active_super_admin_count(uuid)     from public, anon, authenticated, service_role;
revoke all on function app_private.bootstrap_super_admin(text)        from public, anon, authenticated, service_role;
revoke all on function app_private.guard_last_super_admin_role()      from public, anon, authenticated, service_role;
revoke all on function app_private.guard_last_super_admin_profile()   from public, anon, authenticated, service_role;
revoke all on function app_private.audit_user_roles()                 from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------
create trigger user_roles_guard_last_super_admin
  before update or delete on public.user_roles
  for each row execute function app_private.guard_last_super_admin_role();

create trigger profiles_guard_last_super_admin
  before update of status on public.profiles
  for each row execute function app_private.guard_last_super_admin_profile();

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function app_private.audit_user_roles();

commit;
