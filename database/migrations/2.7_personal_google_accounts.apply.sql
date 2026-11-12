-- =====================================================================
-- Nexmile HRMS — Migration 2.7: personal Google accounts, invitation-only
-- =====================================================================
-- STATUS: APPLIED to nexmile-hrms-dev (SQL Editor). Re-verified 2026-11-12 via
--         Supabase MCP: 2.7 tests ALL TESTS PASSED.
-- Target:   Supabase project nexmile-hrms-dev.
-- Requires: 2.0–2.4 applied. (Numbers 2.5 and 2.6 are unused.)
-- Rollback: database/migrations/2.7_personal_google_accounts.rollback.sql
-- Test:     database/tests/2.7_personal_google_accounts_tests.sql
--
-- Decision: employees sign in with personal Google accounts (e.g. Gmail).
-- The Google OAuth app is External, so the invitation is the only gate.
--
-- What this does
--   * invitations.email: replaces the @nexmiletechnology.com CHECK with a
--     generic format CHECK (lowercase, exactly one @, no whitespace).
--   * app_private.create_invitation: accepts any valid email. All other
--     rules are unchanged (must equal employees.work_email, role matrix,
--     super_admin never invitable, one pending per email/employee,
--     employee eligibility, 14-day expiry, audit).
--   * app_private.accept_my_invitation: still reads the verified email
--     from auth.users; additionally requires a Google identity in
--     auth.identities.
--   * New app_private.my_invitation_status() (+ public wrapper for
--     authenticated): 'active' | 'invited' | 'none' for the caller, used
--     by /auth/callback to sign out uninvited users. Read-only.
--
-- What this does NOT do
--   * No RLS policy changes, no client write access, no data changes.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app_private.create_invitation(text,text,uuid)') is null
     or to_regprocedure('app_private.accept_my_invitation()') is null then
    raise exception '2.7 aborted: migration 2.3 not found';
  end if;
  if to_regprocedure('app_private.my_invitation_status()') is not null then
    raise exception '2.7 aborted: 2.7 objects already exist';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invitations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%nexmiletechnology%'
  ) then
    raise exception '2.7 aborted: invitations domain CHECK not found';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. invitations.email: domain CHECK -> generic format CHECK
-- ---------------------------------------------------------------------
-- The 2.1 constraint was created inline, so its name was generated.
-- Find it by definition and drop exactly that one.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.invitations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%nexmiletechnology%'
  loop
    execute format('alter table public.invitations drop constraint %I', v_name);
  end loop;
end
$$;

alter table public.invitations
  add constraint invitations_email_format_check
  check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$');

-- ---------------------------------------------------------------------
-- 2. create_invitation: any valid email (other rules unchanged)
-- ---------------------------------------------------------------------
create or replace function app_private.create_invitation(
  p_email text, p_role_key text, p_employee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text := lower(trim(p_email));
  v_status     text;
  v_work_email text;
  v_caller     text;
  v_id         uuid;
begin
  if v_uid is null
     or not app_private.user_has_permission(v_uid, 'invitations.manage') then
    raise exception 'You do not have permission to manage invitations.'
      using errcode = '42501';
  end if;

  if p_role_key = 'super_admin' then
    raise exception 'The Super Admin role cannot be granted by invitation.'
      using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where key = p_role_key) then
    raise exception 'Unknown role.';
  end if;
  if not app_private.user_can_invite_role(v_uid, p_role_key) then
    raise exception 'You are not allowed to invite users with the % role.', p_role_key
      using errcode = '42501';
  end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  select lower(email) into v_caller from auth.users where id = v_uid;
  if v_email = v_caller then
    raise exception 'You cannot invite yourself.';
  end if;

  if p_employee_id is null then
    raise exception 'An employee must be selected.';
  end if;
  select e.employment_status::text, lower(trim(e.work_email))
    into v_status, v_work_email
  from public.employees e
  where e.id = p_employee_id
  for update;
  if not found then
    raise exception 'Employee not found.';
  end if;
  if not app_private.employee_status_invitable(v_status) then
    raise exception 'Only employees who are active, on leave or serving notice can be invited.';
  end if;
  if exists (select 1 from public.profiles where employee_id = p_employee_id) then
    raise exception 'This employee is already linked to a user account.';
  end if;
  if v_work_email is distinct from v_email then
    raise exception 'The email does not match the employee''s work email.';
  end if;

  perform app_private.expire_stale_invitations(v_email, null);
  perform app_private.expire_stale_invitations(null, p_employee_id);

  if exists (select 1 from public.invitations
             where status = 'pending'
               and (email = v_email or employee_id = p_employee_id)) then
    raise exception 'A pending invitation already exists for this email or employee.';
  end if;

  insert into public.invitations (email, role_key, employee_id, invited_by, expires_at)
  values (v_email, p_role_key, p_employee_id, v_uid, now() + interval '14 days')
  returning id into v_id;

  perform app_private.write_audit('invitation_created', 'invitation', v_id,
    pg_catalog.jsonb_build_object('email', v_email, 'role', p_role_key,
                                  'employee_id', p_employee_id));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. accept_my_invitation: additionally require a Google identity
-- ---------------------------------------------------------------------
create or replace function app_private.accept_my_invitation()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_confirmed  timestamptz;
  v_inv        public.invitations%rowtype;
  v_profile    public.profiles%rowtype;
  v_status     text;
  v_work_email text;
  v_latest     text;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  -- Verified email straight from auth.users; never from input/metadata.
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmed is null then
    return 'none';
  end if;

  perform app_private.expire_stale_invitations(v_email, null);

  select * into v_inv
  from public.invitations
  where email = v_email and status = 'pending' and expires_at > now()
  for update;

  if not found then
    select status into v_latest
    from public.invitations
    where email = v_email
    order by created_at desc
    limit 1;
    return case when v_latest = 'expired' then 'expired' else 'none' end;
  end if;

  -- New in 2.7: the account must have signed in with Google.
  if not exists (select 1 from auth.identities i
                 where i.user_id = v_uid and i.provider = 'google') then
    raise exception 'Invitations can only be accepted after signing in with Google.';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Your profile was not found. Please contact an administrator.';
  end if;
  if v_profile.status = 'suspended' then
    raise exception 'Your account is suspended. Please contact an administrator.';
  end if;
  if v_profile.employee_id is not null and v_profile.employee_id <> v_inv.employee_id then
    raise exception 'Your account is already linked to a different employee record.';
  end if;

  -- Re-validate the employee at acceptance time.
  select e.employment_status::text, lower(trim(e.work_email)) into v_status, v_work_email
  from public.employees e where e.id = v_inv.employee_id for update;
  if not found
     or not app_private.employee_status_invitable(v_status)
     or v_work_email is distinct from v_email
     or exists (select 1 from public.profiles
                where employee_id = v_inv.employee_id and id <> v_uid) then
    raise exception 'This invitation is no longer valid. Please contact an administrator.';
  end if;

  -- The inviter must still be allowed to grant this role.
  if not app_private.user_can_invite_role(v_inv.invited_by, v_inv.role_key) then
    raise exception 'This invitation is no longer valid. Please contact an administrator.';
  end if;

  update public.profiles
     set employee_id = v_inv.employee_id, status = 'active'
   where id = v_uid;

  insert into public.user_roles (user_id, role_key, granted_by)
  values (v_uid, v_inv.role_key, v_inv.invited_by)
  on conflict (user_id, role_key) do nothing;

  update public.invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  perform app_private.write_audit('invitation_accepted', 'invitation', v_inv.id,
    pg_catalog.jsonb_build_object('email', v_email, 'role', v_inv.role_key,
                                  'employee_id', v_inv.employee_id, 'user_id', v_uid));
  return 'accepted';
end;
$$;

-- ---------------------------------------------------------------------
-- 4. my_invitation_status: read-only gate used by /auth/callback
-- ---------------------------------------------------------------------
--   'active'  : active profile with at least one role
--   'invited' : verified email + Google identity + pending, unexpired
--               invitation for that email
--   'none'    : anything else (caller should be signed out)
create function app_private.my_invitation_status()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
begin
  if v_uid is null then
    return 'none';
  end if;

  if exists (select 1
             from public.profiles p
             join public.user_roles ur on ur.user_id = p.id
             where p.id = v_uid and p.status = 'active') then
    return 'active';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmed is null then
    return 'none';
  end if;

  if not exists (select 1 from auth.identities i
                 where i.user_id = v_uid and i.provider = 'google') then
    return 'none';
  end if;

  if exists (select 1 from public.invitations
             where email = v_email and status = 'pending' and expires_at > now()) then
    return 'invited';
  end if;

  return 'none';
end;
$$;

create function public.my_invitation_status()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select app_private.my_invitation_status(); $$;

-- ---------------------------------------------------------------------
-- 5. Privileges (create or replace keeps existing grants on 2/3)
-- ---------------------------------------------------------------------
revoke all on function app_private.my_invitation_status() from public, anon, service_role;
grant execute on function app_private.my_invitation_status() to authenticated;
revoke all on function public.my_invitation_status() from public, anon, service_role;
grant execute on function public.my_invitation_status() to authenticated;

commit;
