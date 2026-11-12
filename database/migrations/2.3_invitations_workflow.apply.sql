-- =====================================================================
-- Nexmile HRMS — Migration 2.3: invitations workflow
-- =====================================================================
-- STATUS: APPLIED to nexmile-hrms-dev on 2026-11-12 (manually, SQL Editor) and verified
--         by database/tests/2.3_2.4_access_tests.sql (ALL TESTS PASSED).
-- Target:   Supabase project nexmile-hrms-dev.
-- Requires: 2.0, 2.1, 2.2 applied.
-- Rollback: database/migrations/2.3_invitations_workflow.rollback.sql
--
-- What this does
--   * app_private (SECURITY DEFINER, empty search_path, audited):
--       create_invitation(email, role_key, employee_id)  -> uuid
--       revoke_invitation(id)                            -> void
--       accept_my_invitation()                           -> 'accepted' | 'none' | 'expired'
--       list_invitations()                               -> table (admin list)
--       list_invitable_employees()                       -> table (admin picker)
--     plus private helpers that no API role can execute.
--   * Thin SECURITY INVOKER wrappers with the same names in public, so the
--     app can call them via PostgREST RPC (app_private is not exposed).
--     Executable by authenticated only; revoked from public and anon.
--
-- Rules enforced in the database (the UI only mirrors them)
--   * Caller needs invitations.manage (create, revoke, list).
--   * super_admin can never be invited.
--   * Only super_admin may invite payroll_admin or hr_admin; hr_admin may
--     invite manager or employee only. The same rule applies to revoking.
--   * The employee must exist, have employment_status ACTIVE / ON_LEAVE /
--     NOTICE_PERIOD, not be linked to a profile, and employees.work_email
--     must equal the invited email (case-insensitive).
--   * Invitations expire after 14 days; stale ones are marked 'expired'.
--   * Acceptance reads the caller's VERIFIED email from auth.users (never
--     from input or user metadata), refuses suspended accounts, and
--     re-checks that the inviter still holds the right to grant the role.
--
-- What this does NOT do
--   * No table, column or RLS policy changes. No client write policies.
--   * Sends no email: invitations are delivered manually.
--
-- employees columns used (checked in pre-flight): id, employee_code,
-- first_name, middle_name, last_name, work_email, employment_status
-- (values ACTIVE, ON_LEAVE, NOTICE_PERIOD, INACTIVE).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks
-- ---------------------------------------------------------------------
do $$
declare
  probe record;
begin
  if to_regprocedure('app_private.bootstrap_super_admin(text)') is null then
    raise exception '2.3 aborted: migration 2.2 not found';
  end if;
  if to_regprocedure('app_private.create_invitation(text,text,uuid)') is not null then
    raise exception '2.3 aborted: 2.3 objects already exist';
  end if;

  if exists (
    select 1
    from unnest(array['employee_code', 'first_name', 'middle_name', 'last_name',
                      'work_email', 'employment_status']) as c(name)
    where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'employees'
                        and column_name = c.name)
  ) then
    raise exception '2.3 aborted: public.employees is missing an expected column';
  end if;

  -- audit_logs must accept the new action / entity_type values.
  for probe in
    select * from (values
      ('invitation_created',        'invitation'),
      ('invitation_revoked',        'invitation'),
      ('invitation_accepted',       'invitation'),
      ('invitation_expired',        'invitation'),
      ('employee_work_email_fixed', 'employee')) as v(action, entity_type)
  loop
    begin
      insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
      values (probe.action, probe.entity_type, gen_random_uuid(), '{}'::jsonb, null);
      raise exception using errcode = 'P0001', message = '__2_3_probe_ok__';
    exception
      when others then
        if sqlerrm <> '__2_3_probe_ok__' then
          raise exception '2.3 aborted: audit_logs rejected (%, %): %',
            probe.action, probe.entity_type, sqlerrm;
        end if;
    end;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Private helpers (no API role may execute these)
-- ---------------------------------------------------------------------
-- Role / permission checks for an arbitrary user (active profile only).
create function app_private.user_has_role(p_user uuid, p_role text)
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
    where p.id = p_user and p.status = 'active' and ur.role_key = p_role
  );
$$;

create function app_private.user_has_permission(p_user uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur       on ur.user_id = p.id
    join public.role_permissions rp on rp.role_key = ur.role_key
    where p.id = p_user and p.status = 'active' and rp.permission_key = p_permission
  );
$$;

-- The invitation matrix. Single source of truth for create, revoke and
-- the acceptance-time re-check.
create function app_private.user_can_invite_role(p_user uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
     and app_private.user_has_permission(p_user, 'invitations.manage')
     and case
           when p_role = 'super_admin' then false
           when p_role in ('payroll_admin', 'hr_admin')
             then app_private.user_has_role(p_user, 'super_admin')
           when p_role in ('manager', 'employee')
             then app_private.user_has_role(p_user, 'super_admin')
               or app_private.user_has_role(p_user, 'hr_admin')
           else false
         end;
$$;

-- Employment statuses that may receive a login (INACTIVE may not).
create function app_private.employee_status_invitable(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_status in ('ACTIVE', 'ON_LEAVE', 'NOTICE_PERIOD'), false);
$$;

-- "First Middle Last", skipping empty parts.
create function app_private.employee_full_name(
  p_first text, p_middle text, p_last text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(concat_ws(' ', nullif(trim(p_first), ''),
                                    nullif(trim(p_middle), ''),
                                    nullif(trim(p_last), ''))), '');
$$;

-- Audit writer; actor is the calling user's linked employee (may be null).
create function app_private.write_audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user uuid := auth.uid();
  v_actor_employee uuid;
begin
  if v_actor_user is not null then
    select employee_id into v_actor_employee from public.profiles where id = v_actor_user;
  end if;
  insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
  values (p_action, p_entity_type, p_entity_id,
          coalesce(p_details, '{}'::jsonb)
            || pg_catalog.jsonb_build_object('actor_user_id', v_actor_user, 'at', now()),
          v_actor_employee);
end;
$$;

-- Marks pending-but-past-expiry invitations as expired (optionally only
-- for one email or one employee). Returns how many were expired.
create function app_private.expire_stale_invitations(
  p_email text default null, p_employee_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.invitations
       set status = 'expired'
     where status = 'pending'
       and expires_at <= now()
       and (p_email is null or email = lower(p_email))
       and (p_employee_id is null or employee_id = p_employee_id)
    returning id, email, role_key, employee_id
  loop
    perform app_private.write_audit('invitation_expired', 'invitation', r.id,
      pg_catalog.jsonb_build_object('email', r.email, 'role', r.role_key,
                                    'employee_id', r.employee_id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. create_invitation
-- ---------------------------------------------------------------------
create function app_private.create_invitation(
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

  if v_email is null or v_email !~ '^[^@\s]+@nexmiletechnology\.com$' then
    raise exception 'The email must be a @nexmiletechnology.com address.';
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
-- 3. revoke_invitation
-- ---------------------------------------------------------------------
create function app_private.revoke_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations%rowtype;
begin
  if v_uid is null
     or not app_private.user_has_permission(v_uid, 'invitations.manage') then
    raise exception 'You do not have permission to manage invitations.'
      using errcode = '42501';
  end if;

  select * into v_inv from public.invitations where id = p_id for update;
  if not found then
    raise exception 'Invitation not found.';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked.';
  end if;
  if not app_private.user_can_invite_role(v_uid, v_inv.role_key) then
    raise exception 'You are not allowed to revoke invitations for the % role.', v_inv.role_key
      using errcode = '42501';
  end if;

  update public.invitations
     set status = 'revoked', revoked_at = now()
   where id = p_id;

  perform app_private.write_audit('invitation_revoked', 'invitation', p_id,
    pg_catalog.jsonb_build_object('email', v_inv.email, 'role', v_inv.role_key,
                                  'employee_id', v_inv.employee_id));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. accept_my_invitation
-- ---------------------------------------------------------------------
create function app_private.accept_my_invitation()
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
-- 5. Admin read functions
-- ---------------------------------------------------------------------
create function app_private.list_invitations()
returns table (
  id uuid, email text, role_key text, role_name text,
  employee_id uuid, employee_code text, employee_name text,
  status text, invited_by_email text,
  created_at timestamptz, expires_at timestamptz,
  accepted_at timestamptz, revoked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.user_has_permission(auth.uid(), 'invitations.manage') then
    raise exception 'You do not have permission to manage invitations.'
      using errcode = '42501';
  end if;

  return query
  select i.id, i.email, i.role_key, r.name,
         i.employee_id,
         e.employee_code::text,
         app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
         -- Show stale pending invitations as expired even before cleanup.
         case when i.status = 'pending' and i.expires_at <= now()
              then 'expired' else i.status end,
         lower(inviter.email)::text,
         i.created_at, i.expires_at, i.accepted_at, i.revoked_at
  from public.invitations i
  join public.roles r on r.key = i.role_key
  left join public.employees e on e.id = i.employee_id
  left join auth.users inviter on inviter.id = i.invited_by
  order by i.created_at desc
  limit 500;
end;
$$;

create function app_private.list_invitable_employees()
returns table (id uuid, employee_code text, full_name text, work_email text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.user_has_permission(auth.uid(), 'invitations.manage') then
    raise exception 'You do not have permission to manage invitations.'
      using errcode = '42501';
  end if;

  return query
  select e.id,
         e.employee_code::text,
         app_private.employee_full_name(e.first_name, e.middle_name, e.last_name),
         lower(trim(e.work_email))::text,
         e.employment_status::text
  from public.employees e
  where app_private.employee_status_invitable(e.employment_status::text)
    and e.work_email is not null
    and not exists (select 1 from public.profiles p where p.employee_id = e.id)
    and not exists (select 1 from public.invitations i
                    where i.employee_id = e.id and i.status = 'pending'
                      and i.expires_at > now())
  order by e.employee_code nulls last, 3;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Public RPC wrappers (SECURITY INVOKER; logic stays in app_private)
-- ---------------------------------------------------------------------
create function public.create_invitation(p_email text, p_role_key text, p_employee_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select app_private.create_invitation(p_email, p_role_key, p_employee_id); $$;

create function public.revoke_invitation(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.revoke_invitation(p_id); $$;

create function public.accept_my_invitation()
returns text
language sql
security invoker
set search_path = ''
as $$ select app_private.accept_my_invitation(); $$;

create function public.list_invitations()
returns table (
  id uuid, email text, role_key text, role_name text,
  employee_id uuid, employee_code text, employee_name text,
  status text, invited_by_email text,
  created_at timestamptz, expires_at timestamptz,
  accepted_at timestamptz, revoked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$ select * from app_private.list_invitations(); $$;

create function public.list_invitable_employees()
returns table (id uuid, employee_code text, full_name text, work_email text, status text)
language sql
stable
security invoker
set search_path = ''
as $$ select * from app_private.list_invitable_employees(); $$;

-- ---------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------
-- Private helpers: nobody but the owner.
revoke all on function app_private.user_has_role(uuid, text)                from public, anon, authenticated, service_role;
revoke all on function app_private.user_has_permission(uuid, text)          from public, anon, authenticated, service_role;
revoke all on function app_private.user_can_invite_role(uuid, text)         from public, anon, authenticated, service_role;
revoke all on function app_private.employee_status_invitable(text)          from public, anon, authenticated, service_role;
revoke all on function app_private.employee_full_name(text, text, text)     from public, anon, authenticated, service_role;
revoke all on function app_private.write_audit(text, text, uuid, jsonb)     from public, anon, authenticated, service_role;
revoke all on function app_private.expire_stale_invitations(text, uuid)     from public, anon, authenticated, service_role;

-- Entry points: authenticated only (each checks permissions itself).
revoke all on function app_private.create_invitation(text, text, uuid)      from public, anon, service_role;
revoke all on function app_private.revoke_invitation(uuid)                  from public, anon, service_role;
revoke all on function app_private.accept_my_invitation()                   from public, anon, service_role;
revoke all on function app_private.list_invitations()                       from public, anon, service_role;
revoke all on function app_private.list_invitable_employees()               from public, anon, service_role;
grant execute on function app_private.create_invitation(text, text, uuid)   to authenticated;
grant execute on function app_private.revoke_invitation(uuid)               to authenticated;
grant execute on function app_private.accept_my_invitation()                to authenticated;
grant execute on function app_private.list_invitations()                    to authenticated;
grant execute on function app_private.list_invitable_employees()            to authenticated;

-- Public wrappers: Supabase grants new public functions to anon by
-- default, so revoke explicitly.
revoke all on function public.create_invitation(text, text, uuid)           from public, anon, service_role;
revoke all on function public.revoke_invitation(uuid)                       from public, anon, service_role;
revoke all on function public.accept_my_invitation()                        from public, anon, service_role;
revoke all on function public.list_invitations()                            from public, anon, service_role;
revoke all on function public.list_invitable_employees()                    from public, anon, service_role;
grant execute on function public.create_invitation(text, text, uuid)        to authenticated;
grant execute on function public.revoke_invitation(uuid)                    to authenticated;
grant execute on function public.accept_my_invitation()                     to authenticated;
grant execute on function public.list_invitations()                         to authenticated;
grant execute on function public.list_invitable_employees()                 to authenticated;

commit;
