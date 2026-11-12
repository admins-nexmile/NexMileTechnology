-- =====================================================================
-- Nexmile HRMS — Rollback for Migration 2.1 (auth foundation)
-- =====================================================================
-- STATUS: NOT RUN. Use only to undo 2.1, after explicit approval.
--
-- Drops ONLY objects created by 2.1:
--   * trigger on_auth_user_created on auth.users
--   * tables invitations, user_roles, role_permissions, profiles,
--     permissions, roles (with their own indexes, triggers and policies)
--   * the five indexes 2.1 added to existing tables
--   * functions in app_private, then the app_private schema
--
-- Never touches:
--   * public.employee_compensation's table, data or RLS setting. RLS
--     stays ENABLED (project rule: RLS is never disabled). Only the index
--     2.1 added to it is dropped.
--   * the original 14 tables (other than dropping 2.1's indexes), their
--     data or RLS.
--   * anything from 2.0 (the dropped draft tables are NOT recreated).
--   * auth.users rows.
--
-- DESTRUCTIVE: permanently deletes every row in the six 2.1 tables
-- (profiles, user_roles, invitations, roles, permissions,
-- role_permissions). Export them first if their data matters.
--
-- Strict by design: no IF EXISTS and no CASCADE, so it fails (and the
-- transaction rolls back) if 2.1 was not applied or if a later
-- migration added dependent objects. Roll those back first.
-- =====================================================================

begin;

-- 1. Trigger on auth.users
drop trigger on_auth_user_created on auth.users;

-- 2. Indexes 2.1 added to existing tables
drop index public.employee_documents_employee_id_idx;
drop index public.leave_requests_approver_id_idx;
drop index public.training_enrollments_employee_id_idx;
drop index public.audit_logs_actor_employee_id_idx;
drop index public.employee_compensation_employee_id_idx;

-- 3. Tables 2.1 created (children first)
drop table public.invitations;
drop table public.user_roles;
drop table public.role_permissions;
drop table public.profiles;
drop table public.permissions;
drop table public.roles;

-- 4. Functions, then schema
drop function app_private.handle_new_auth_user();
drop function app_private.enforce_sensitive_flag();
drop function app_private.enforce_sensitive_permission_roles();
drop function app_private.set_updated_at();
drop function app_private.has_role(text);
drop function app_private.has_permission(text);

drop schema app_private;

commit;
