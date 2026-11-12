-- =====================================================================
-- Nexmile HRMS — Rollback for Migration 2.7 (personal Google accounts)
-- =====================================================================
-- STATUS: NOT RUN. Use only to undo 2.7, after explicit approval.
--
-- Restores the 2.3 behaviour:
--   * drops my_invitation_status (public wrapper and app_private);
--   * restores app_private.create_invitation and accept_my_invitation to
--     their exact 2.3 definitions;
--   * replaces invitations_email_format_check with the
--     @nexmiletechnology.com domain CHECK.
--
-- ABORTS (changes nothing) if any invitation row has a non-
-- @nexmiletechnology.com email, because the domain CHECK could not be
-- re-added. Invitation history is never deleted by this script; such
-- rows must be dealt with by a separate, reviewed step first.
--
-- After rollback the app (which allows personal Google accounts) and the
-- database disagree; roll back the app change too.
--
-- Strict: no IF EXISTS / CASCADE; fails if 2.7 was not applied.
-- =====================================================================

begin;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.invitations
  where email !~ '^[^@\s]+@nexmiletechnology\.com$';
  if v_count > 0 then
    raise exception '2.7 rollback aborted: % invitation(s) use a non-company email', v_count;
  end if;
end
$$;

-- 1. Drop the 2.7 status function.
drop function public.my_invitation_status();
drop function app_private.my_invitation_status();

-- 2. Restore the 2.3 email CHECK.
alter table public.invitations drop constraint invitations_email_format_check;
alter table public.invitations
  add constraint invitations_email_domain_check
  check (email = lower(email) and email ~ '^[^@\s]+@nexmiletechnology\.com$');

-- 3. Restore create_invitation (2.3 definition).
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

-- 4. Restore accept_my_invitation (2.3 definition, no Google check).
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

  select e.employment_status::text, lower(trim(e.work_email)) into v_status, v_work_email
  from public.employees e where e.id = v_inv.employee_id for update;
  if not found
     or not app_private.employee_status_invitable(v_status)
     or v_work_email is distinct from v_email
     or exists (select 1 from public.profiles
                where employee_id = v_inv.employee_id and id <> v_uid) then
    raise exception 'This invitation is no longer valid. Please contact an administrator.';
  end if;

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

commit;
