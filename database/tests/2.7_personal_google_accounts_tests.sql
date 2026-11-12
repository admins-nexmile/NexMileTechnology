-- =====================================================================
-- Nexmile HRMS — Tests for migration 2.7 (personal Google accounts)
-- =====================================================================
-- Run in the Supabase SQL Editor AFTER applying 2.7.
--
-- SAFE: one transaction ending in ROLLBACK. Test users, identities,
-- employee email changes, invitations and audit rows are discarded.
-- Any failed expectation raises "FAIL: ..." and stops the script.
-- If everything passes, the last query returns "ALL TESTS PASSED".
--
-- Users are simulated as PostgREST does: SET ROLE authenticated plus
-- request.jwt.claims with the user id. Addresses are fictional.
--
-- Tests
--   1. A Gmail invitation can be created (hr_admin, matching work_email).
--   2. A different Gmail user cannot accept it ('none'; stays pending).
--   3. The invited Gmail user can accept it ('invited' -> 'accepted'
--      -> 'active').
--   4. An uninvited Gmail user gets 'none' and reads zero rows from
--      departments and employees.
--   5. An invited user WITHOUT a Google identity cannot accept.
--   6. A malformed email is rejected by create_invitation.
--
-- Requires: a super_admin, and two employees with employment_status
-- ACTIVE / ON_LEAVE / NOTICE_PERIOD not linked to any profile.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Setup (as the database owner)
-- ---------------------------------------------------------------------
do $$
declare
  v_sa      uuid;
  v_e1      uuid;
  v_e2      uuid;
  v_has_pid boolean;
  r         record;
begin
  select ur.user_id into v_sa
  from public.user_roles ur where ur.role_key = 'super_admin' limit 1;
  if v_sa is null then
    raise exception 'FAIL: setup: no super_admin found';
  end if;

  -- a101 hr_admin, a102 invitee, a103 different user, a104 uninvited,
  -- a105 invited but no Google identity. All verified, all Gmail.
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
         'authenticated', v.email, now(), '{"provider":"google"}',
         jsonb_build_object('full_name', v.name), now(), now()
  from (values
    ('00000000-0000-4000-8000-00000000a101', 'hrms.test.hr.2026@gmail.com',       'Test HR'),
    ('00000000-0000-4000-8000-00000000a102', 'hrms.test.invitee.2026@gmail.com',  'Test Invitee'),
    ('00000000-0000-4000-8000-00000000a103', 'hrms.test.other.2026@gmail.com',    'Test Other'),
    ('00000000-0000-4000-8000-00000000a104', 'hrms.test.uninvited.2026@gmail.com','Test Uninvited'),
    ('00000000-0000-4000-8000-00000000a105', 'hrms.test.nogoogle.2026@gmail.com', 'Test No Google')
  ) as v(id, email, name);

  -- Google identities for a101-a104 (not a105). Handles both the current
  -- auth.identities layout (provider_id) and the older one (text id).
  v_has_pid := exists (select 1 from information_schema.columns
                       where table_schema = 'auth' and table_name = 'identities'
                         and column_name = 'provider_id');
  for r in
    select u.id, u.email from auth.users u
    where u.id in ('00000000-0000-4000-8000-00000000a101',
                   '00000000-0000-4000-8000-00000000a102',
                   '00000000-0000-4000-8000-00000000a103',
                   '00000000-0000-4000-8000-00000000a104')
  loop
    if v_has_pid then
      execute 'insert into auth.identities (provider_id, user_id, identity_data, provider, '
           || 'last_sign_in_at, created_at, updated_at) '
           || 'values ($1, $2, $3, ''google'', now(), now(), now())'
      using 'test-' || r.id::text, r.id,
            jsonb_build_object('sub', 'test-' || r.id::text, 'email', r.email,
                               'email_verified', true);
    else
      execute 'insert into auth.identities (id, user_id, identity_data, provider, '
           || 'last_sign_in_at, created_at, updated_at) '
           || 'values ($1, $2, $3, ''google'', now(), now(), now())'
      using 'test-' || r.id::text, r.id,
            jsonb_build_object('sub', 'test-' || r.id::text, 'email', r.email,
                               'email_verified', true);
    end if;
  end loop;

  -- a101 becomes an active hr_admin.
  update public.profiles set status = 'active'
  where id = '00000000-0000-4000-8000-00000000a101';
  insert into public.user_roles (user_id, role_key, granted_by)
  values ('00000000-0000-4000-8000-00000000a101', 'hr_admin', v_sa);

  -- Two eligible, unlinked employees without an open invitation.
  select e.id into v_e1
  from public.employees e
  where app_private.employee_status_invitable(e.employment_status::text)
    and not exists (select 1 from public.profiles p where p.employee_id = e.id)
    and not exists (select 1 from public.invitations i
                    where i.employee_id = e.id and i.status = 'pending')
  order by e.id limit 1;

  select e.id into v_e2
  from public.employees e
  where app_private.employee_status_invitable(e.employment_status::text)
    and e.id <> v_e1
    and not exists (select 1 from public.profiles p where p.employee_id = e.id)
    and not exists (select 1 from public.invitations i
                    where i.employee_id = e.id and i.status = 'pending')
  order by e.id limit 1;

  if v_e1 is null or v_e2 is null then
    raise exception 'FAIL: setup: need two eligible, unlinked employees';
  end if;

  update public.employees set work_email = 'hrms.test.invitee.2026@gmail.com'  where id = v_e1;
  update public.employees set work_email = 'hrms.test.nogoogle.2026@gmail.com' where id = v_e2;

  perform set_config('test.e1', v_e1::text, true);
  perform set_config('test.e2', v_e2::text, true);
end
$$;

-- ---------------------------------------------------------------------
-- As hr_admin (a101): tests 1, 6 and setup for 5
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a101","role":"authenticated"}', true);
set local role authenticated;

-- 1. Gmail invitation can be created
do $$
declare v_id uuid;
begin
  v_id := public.create_invitation('hrms.test.invitee.2026@gmail.com', 'employee',
                                   current_setting('test.e1')::uuid);
  if v_id is null then
    raise exception 'FAIL: 1: Gmail invitation was not created';
  end if;
  perform set_config('test.inv1', v_id::text, true);
  raise notice 'PASS 1: Gmail invitation created';
end
$$;

-- 5 (setup). invitation for the user who has no Google identity
do $$
declare v_id uuid;
begin
  v_id := public.create_invitation('hrms.test.nogoogle.2026@gmail.com', 'employee',
                                   current_setting('test.e2')::uuid);
  perform set_config('test.inv5', v_id::text, true);
end
$$;

-- 6. malformed email rejected
do $$
begin
  perform public.create_invitation('not an email', 'employee',
                                   current_setting('test.e1')::uuid);
  raise exception 'FAIL: 6: malformed email accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'Enter a valid email address%' then
    raise exception 'FAIL: 6: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 6: malformed email rejected';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 2. A different Gmail user (a103) cannot accept it
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a103","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if public.my_invitation_status() <> 'none' then
    raise exception 'FAIL: 2: different user status is not none';
  end if;
  if public.accept_my_invitation() <> 'none' then
    raise exception 'FAIL: 2: different user did not get none';
  end if;
  raise notice 'PASS 2: different Gmail user -> none';
end
$$;

reset role;

do $$
begin
  if (select status from public.invitations
      where id = current_setting('test.inv1')::uuid) <> 'pending' then
    raise exception 'FAIL: 2: invitation changed after a different user tried it';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 3. The invited Gmail user (a102) accepts
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a102","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v text;
begin
  v := public.my_invitation_status();
  if v <> 'invited' then
    raise exception 'FAIL: 3: status before accept was %', v;
  end if;
  v := public.accept_my_invitation();
  if v <> 'accepted' then
    raise exception 'FAIL: 3: accept returned %', v;
  end if;
  v := public.my_invitation_status();
  if v <> 'active' then
    raise exception 'FAIL: 3: status after accept was %', v;
  end if;
  raise notice 'PASS 3: invited Gmail user accepted and is active';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 4. Uninvited Gmail user (a104): 'none' and zero rows
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a104","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_dept bigint; v_emp bigint;
begin
  if public.my_invitation_status() <> 'none' then
    raise exception 'FAIL: 4: uninvited status is not none';
  end if;
  if public.accept_my_invitation() <> 'none' then
    raise exception 'FAIL: 4: uninvited accept is not none';
  end if;
  select count(*) into v_dept from public.departments;
  select count(*) into v_emp  from public.employees;
  if v_dept <> 0 or v_emp <> 0 then
    raise exception 'FAIL: 4: uninvited user read % departments and % employees', v_dept, v_emp;
  end if;
  raise notice 'PASS 4: uninvited Gmail user -> none, 0 departments, 0 employees';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- 5. Invited user without a Google identity (a105) cannot accept
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a105","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if public.my_invitation_status() <> 'none' then
    raise exception 'FAIL: 5: non-Google user status is not none';
  end if;
  perform public.accept_my_invitation();
  raise exception 'FAIL: 5: non-Google user accepted an invitation';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like 'Invitations can only be accepted after signing in with Google%' then
    raise exception 'FAIL: 5: unexpected error: %', sqlerrm;
  end if;
  raise notice 'PASS 5: non-Google user cannot accept';
end
$$;

reset role;

-- ---------------------------------------------------------------------
-- Final state checks (as owner)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.invitations
                 where id = current_setting('test.inv1')::uuid
                   and status = 'accepted'
                   and accepted_by = '00000000-0000-4000-8000-00000000a102') then
    raise exception 'FAIL: final: invitation 1 not accepted by the invitee';
  end if;
  if (select status from public.invitations
      where id = current_setting('test.inv5')::uuid) <> 'pending' then
    raise exception 'FAIL: final: non-Google invitation is no longer pending';
  end if;
  if (select employee_id from public.profiles
      where id = '00000000-0000-4000-8000-00000000a102')
     is distinct from current_setting('test.e1')::uuid then
    raise exception 'FAIL: final: invitee profile not linked to the employee';
  end if;
end
$$;

select 'ALL TESTS PASSED' as result;

rollback;
