-- =====================================================================
-- Nexmile HRMS — Migration 2.1: authentication & authorization foundation
-- =====================================================================
-- STATUS: APPLIED to nexmile-hrms-dev on 2026-11-12 (manually, SQL Editor) and verified.
-- Target:   Supabase project nexmile-hrms-dev (PostgreSQL 15+).
-- Requires: 2.0_drop_draft_auth_tables.sql applied first.
-- Rollback: database/migrations/2.1_auth_foundation.rollback.sql
--
-- What this does
--   * Creates schema app_private (NOT exposed through the Data API) for
--     helper and trigger functions.
--   * Creates public tables: roles, permissions, role_permissions,
--     profiles, user_roles, invitations. RLS is ENABLED on all of them.
--   * Links profiles and invitations to public.employees (uuid).
--   * Seeds the role and permission catalogue. Salary / CTC / payroll
--     permissions are marked sensitive and triggers guarantee they can
--     only ever be granted to super_admin and payroll_admin.
--   * Adds an AFTER INSERT trigger on auth.users that creates a 'pending'
--     profile. It never reads roles from user metadata.
--   * Backfills profiles for any existing auth.users (insert only).
--   * Adds five missing foreign-key indexes on existing tables.
--   * Ensures RLS is enabled on public.employee_compensation, with NO
--     policies (fully locked for anon/authenticated).
--
-- What this does NOT do
--   * Does not change data, columns or RLS policies of the 14 existing
--     tables (it only adds indexes to four of them).
--   * Does not grant any role to anyone (Super Admin bootstrap is a
--     separate, reviewed step).
--   * Creates no write policies: no client can insert/update/delete the
--     new tables. All writes will go through reviewed server-side code.
--
-- Locking: CREATE INDEX (non-concurrent) briefly blocks writes on
-- employee_documents, leave_requests, training_enrollments, audit_logs
-- and employee_compensation. These tables hold small demo data sets.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight checks (abort on unexpected state)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- 2.0 must have removed the draft tables.
  foreach t in array array['profiles', 'user_roles', 'role_permissions',
                           'invitations', 'roles', 'permissions']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      raise exception '2.1 aborted: public.% already exists (apply 2.0 first?)', t;
    end if;
  end loop;

  if to_regnamespace('app_private') is not null then
    raise exception '2.1 aborted: schema app_private already exists';
  end if;

  -- Columns this migration references must exist with the expected type.
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'employees'
        and column_name = 'id') is distinct from 'uuid' then
    raise exception '2.1 aborted: public.employees.id is missing or not uuid';
  end if;

  if exists (
    select 1
    from (values ('employee_documents',    'employee_id'),
                 ('leave_requests',        'approver_id'),
                 ('training_enrollments',  'employee_id'),
                 ('audit_logs',            'actor_employee_id'),
                 ('employee_compensation', 'employee_id')) as v(tbl, col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v.tbl
        and c.column_name = v.col)
  ) then
    raise exception '2.1 aborted: an expected column for the new indexes is missing';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Private schema
-- ---------------------------------------------------------------------
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
-- RLS policies evaluate helper functions as the calling role, so
-- authenticated needs USAGE (but nothing else) on this schema.
grant usage on schema app_private to authenticated;

-- ---------------------------------------------------------------------
-- 2. Role & permission catalogue
-- ---------------------------------------------------------------------
create table public.roles (
  key          text primary key
                 check (key ~ '^[a-z][a-z0-9_]{1,49}$'),
  name         text not null check (length(trim(name)) between 1 and 100),
  description  text not null default '',
  is_system    boolean not null default true,
  created_at   timestamptz not null default now()
);
comment on table public.roles is 'Application roles. Managed by migrations only.';

create table public.permissions (
  key           text primary key
                  check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  description   text not null default '',
  -- Sensitive = salary, CTC, payroll or payslip data.
  is_sensitive  boolean not null default false,
  created_at    timestamptz not null default now()
);
comment on table public.permissions is 'Permission catalogue. is_sensitive permissions are restricted to super_admin and payroll_admin.';

create table public.role_permissions (
  role_key        text not null references public.roles (key) on update cascade on delete cascade,
  permission_key  text not null references public.permissions (key) on update cascade on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (role_key, permission_key)
);
create index role_permissions_permission_key_idx on public.role_permissions (permission_key);

-- ---------------------------------------------------------------------
-- 3. Profiles (one per auth user, optionally linked to one employee)
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  -- unique: one login per employee record. Set only by server-side
  -- invitation acceptance, never by the user.
  employee_id  uuid unique references public.employees (id) on delete set null,
  email        text check (email is null or email = lower(email)),
  full_name    text check (full_name is null or length(full_name) <= 200),
  status       text not null default 'pending'
                 check (status in ('pending', 'active', 'suspended')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (email);
comment on table public.profiles is 'One row per auth user. Only status = active users receive permissions.';

-- ---------------------------------------------------------------------
-- 4. User ↔ role assignments
-- ---------------------------------------------------------------------
create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role_key    text not null references public.roles (key) on update cascade on delete restrict,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_key),
  check (granted_by is null or granted_by <> user_id)  -- no self-granting
);
create index user_roles_role_key_idx on public.user_roles (role_key);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- ---------------------------------------------------------------------
-- 5. Invitations (accepted by matching the verified Google email; no
--    secret tokens are stored)
-- ---------------------------------------------------------------------
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null
                 check (email = lower(email))
                 check (email ~ '^[^@\s]+@nexmiletechnology\.com$'),
  role_key     text not null references public.roles (key) on update cascade on delete restrict,
  -- Employee record the new login will be linked to (e.g. NX013).
  -- No ON DELETE action: an employee with invitations cannot be deleted
  -- until the invitations are resolved.
  employee_id  uuid references public.employees (id),
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by   uuid references auth.users (id) on delete set null,
  accepted_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  check (expires_at > created_at),
  -- accepted_by may later become NULL (on delete set null), so only
  -- accepted_at is tied to the status.
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null))
);
-- At most one open invitation per email address and per employee.
create unique index invitations_one_pending_per_email_idx
  on public.invitations (email) where status = 'pending';
create unique index invitations_one_pending_per_employee_idx
  on public.invitations (employee_id) where status = 'pending' and employee_id is not null;
create index invitations_employee_id_idx on public.invitations (employee_id);
create index invitations_role_key_idx on public.invitations (role_key);
create index invitations_invited_by_idx on public.invitations (invited_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);

-- ---------------------------------------------------------------------
-- 6. Helper functions (SECURITY DEFINER, empty search_path)
-- ---------------------------------------------------------------------
-- True when the current user is active and holds the permission.
create function app_private.has_permission(permission_key text)
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
    where p.id = (select auth.uid())
      and p.status = 'active'
      and rp.permission_key = has_permission.permission_key
  );
$$;

-- True when the current user is active and holds the role.
create function app_private.has_role(role_key text)
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
    where p.id = (select auth.uid())
      and p.status = 'active'
      and ur.role_key = has_role.role_key
  );
$$;

-- Keeps updated_at current.
create function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Salary/payroll rule: sensitive permissions may only be attached to
-- super_admin or payroll_admin, whoever performs the write.
-- SECURITY DEFINER so RLS on permissions can never hide the row and
-- make the check pass.
create function app_private.enforce_sensitive_permission_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
       select 1 from public.permissions
       where key = new.permission_key and is_sensitive
     )
     and new.role_key not in ('super_admin', 'payroll_admin') then
    raise exception 'Sensitive permission % cannot be granted to role %',
      new.permission_key, new.role_key
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Prevents a permission from becoming sensitive while non-payroll roles
-- already hold it.
create function app_private.enforce_sensitive_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_sensitive and exists (
       select 1 from public.role_permissions
       where permission_key = new.key
         and role_key not in ('super_admin', 'payroll_admin')
     ) then
    raise exception 'Permission % is held by non-payroll roles; revoke it first', new.key
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Creates a pending profile for every new auth user. Roles and the
-- employee link are NEVER derived from raw_user_meta_data (users can
-- edit it).
create function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 200)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Lock down function execution, then grant only what policies need.
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.has_permission(text) to authenticated;
grant execute on function app_private.has_role(text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Triggers
-- ---------------------------------------------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app_private.set_updated_at();

create trigger role_permissions_enforce_sensitive
  before insert or update on public.role_permissions
  for each row execute function app_private.enforce_sensitive_permission_roles();

create trigger permissions_enforce_sensitive_flag
  before insert or update of is_sensitive on public.permissions
  for each row execute function app_private.enforce_sensitive_flag();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- 8. Row Level Security on the new tables (never disabled)
-- ---------------------------------------------------------------------
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.invitations      enable row level security;

-- Table privileges: anon gets nothing; authenticated may only SELECT
-- (and RLS still filters rows). No client writes at all in 2.1.
revoke all on public.roles, public.permissions, public.role_permissions,
              public.profiles, public.user_roles, public.invitations
  from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions,
                public.profiles, public.user_roles, public.invitations
  to authenticated;

-- Catalogue: readable by active users (not by pending/suspended ones).
create policy roles_select_active on public.roles
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.status = 'active'));

create policy permissions_select_active on public.permissions
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.status = 'active'));

create policy role_permissions_select_active on public.role_permissions
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.status = 'active'));

-- Profiles: own row, or anyone with users.read.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select app_private.has_permission('users.read')));

-- User roles: own assignments, or anyone with roles.manage.
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_roles_select_admin on public.user_roles
  for select to authenticated
  using ((select app_private.has_permission('roles.manage')));

-- Invitations: only invitation managers.
create policy invitations_select_admin on public.invitations
  for select to authenticated
  using ((select app_private.has_permission('invitations.manage')));

-- ---------------------------------------------------------------------
-- 9. employee_compensation: keep fully locked
--    RLS on with no policies = no rows for anon/authenticated. Idempotent
--    if already enabled. Policies (super_admin / payroll_admin only, via
--    compensation.read / compensation.manage) come in a later migration.
-- ---------------------------------------------------------------------
alter table public.employee_compensation enable row level security;

-- ---------------------------------------------------------------------
-- 10. Missing foreign-key indexes on existing tables
--     Plain CREATE INDEX (no IF NOT EXISTS) so 2.1 owns exactly these
--     names and the rollback never drops a pre-existing index.
-- ---------------------------------------------------------------------
create index employee_documents_employee_id_idx
  on public.employee_documents (employee_id);
create index leave_requests_approver_id_idx
  on public.leave_requests (approver_id);
create index training_enrollments_employee_id_idx
  on public.training_enrollments (employee_id);
create index audit_logs_actor_employee_id_idx
  on public.audit_logs (actor_employee_id);
create index employee_compensation_employee_id_idx
  on public.employee_compensation (employee_id);

-- ---------------------------------------------------------------------
-- 11. Seed catalogue
-- ---------------------------------------------------------------------
insert into public.roles (key, name, description) values
  ('super_admin',   'Super Admin',   'Full administrative access, including salary and payroll.'),
  ('payroll_admin', 'Payroll Admin', 'Salary, CTC, payroll runs and payslips.'),
  ('hr_admin',      'HR Admin',      'Employee records and invitations. No salary or payroll access.'),
  ('manager',       'Manager',       'Team-level access (scope defined in a later migration).'),
  ('employee',      'Employee',      'Self-service access to own records.');

insert into public.permissions (key, description, is_sensitive) values
  ('users.read',           'View user accounts and profiles',          false),
  ('roles.manage',         'Assign and remove user roles',             false),
  ('invitations.manage',   'Create, view and revoke invitations',      false),
  ('employees.read_all',   'View all employee records (non-salary)',   false),
  ('employees.manage',     'Create and edit employee records',         false),
  ('compensation.read',    'View salary and CTC',                      true),
  ('compensation.manage',  'Edit salary and CTC',                      true),
  ('payroll.read',         'View payroll runs and items',              true),
  ('payroll.manage',       'Create and process payroll runs',          true),
  ('payslips.read_all',    'View every employee''s payslips',          true);

insert into public.role_permissions (role_key, permission_key)
select 'super_admin', key from public.permissions;

insert into public.role_permissions (role_key, permission_key) values
  ('payroll_admin', 'employees.read_all'),
  ('payroll_admin', 'compensation.read'),
  ('payroll_admin', 'compensation.manage'),
  ('payroll_admin', 'payroll.read'),
  ('payroll_admin', 'payroll.manage'),
  ('payroll_admin', 'payslips.read_all'),
  ('hr_admin',      'users.read'),
  ('hr_admin',      'invitations.manage'),
  ('hr_admin',      'employees.read_all'),
  ('hr_admin',      'employees.manage');
-- manager and employee: no global permissions; own/team access will be
-- expressed through ownership-based RLS policies in later migrations.

-- ---------------------------------------------------------------------
-- 12. Backfill profiles for users who signed in before this migration
--     (insert only; employee_id left NULL; existing data untouched)
-- ---------------------------------------------------------------------
insert into public.profiles (id, email, full_name)
select u.id,
       lower(u.email),
       left(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 200)
from auth.users u
on conflict (id) do nothing;

commit;
