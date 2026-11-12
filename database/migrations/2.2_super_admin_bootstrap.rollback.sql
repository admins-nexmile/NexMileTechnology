-- =====================================================================
-- Nexmile HRMS — Rollback for Migration 2.2 (Super Admin bootstrap)
-- =====================================================================
-- STATUS: NOT RUN. Use only to undo 2.2, after explicit approval.
--
-- Drops ONLY the triggers and functions created by 2.2.
--
-- Does NOT undo data written while 2.2 was in place:
--   * the super_admin row in user_roles and the 'active' profile status
--     set by the bootstrap remain;
--   * audit_logs rows remain (audit history is never deleted).
-- Revoking the Super Admin, if ever needed, is a separate reviewed step.
--
-- After this rollback the last-super-admin guard and role auditing are
-- gone, so do not change user_roles until 2.2 is re-applied.
--
-- Strict: no IF EXISTS / CASCADE; fails if 2.2 was not applied.
-- =====================================================================

begin;

drop trigger user_roles_audit on public.user_roles;
drop trigger profiles_guard_last_super_admin on public.profiles;
drop trigger user_roles_guard_last_super_admin on public.user_roles;

drop function app_private.audit_user_roles();
drop function app_private.guard_last_super_admin_profile();
drop function app_private.guard_last_super_admin_role();
drop function app_private.bootstrap_super_admin(text);
drop function app_private.active_super_admin_count(uuid);
drop function app_private.lock_super_admin_set();

commit;
