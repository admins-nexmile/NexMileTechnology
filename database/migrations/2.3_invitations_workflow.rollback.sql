-- =====================================================================
-- Nexmile HRMS — Rollback for Migration 2.3 (invitations workflow)
-- =====================================================================
-- STATUS: NOT RUN. Use only to undo 2.3, after explicit approval.
--
-- Drops ONLY the functions created by 2.3 (public wrappers first, then
-- app_private entry points and helpers).
--
-- Does NOT undo data written while 2.3 was in place: invitation rows and
-- their statuses, profile links/statuses and user_roles granted by
-- accepted invitations, and audit_logs rows all remain.
--
-- If 2.4 is applied, roll it back first (it is independent of 2.3, but
-- keep the order for clarity).
--
-- Strict: no IF EXISTS / CASCADE; fails if 2.3 was not applied.
-- =====================================================================

begin;

drop function public.list_invitable_employees();
drop function public.list_invitations();
drop function public.accept_my_invitation();
drop function public.revoke_invitation(uuid);
drop function public.create_invitation(text, text, uuid);

drop function app_private.list_invitable_employees();
drop function app_private.list_invitations();
drop function app_private.accept_my_invitation();
drop function app_private.revoke_invitation(uuid);
drop function app_private.create_invitation(text, text, uuid);

drop function app_private.expire_stale_invitations(text, uuid);
drop function app_private.write_audit(text, text, uuid, jsonb);
drop function app_private.employee_full_name(text, text, text);
drop function app_private.employee_status_invitable(text);
drop function app_private.user_can_invite_role(uuid, text);
drop function app_private.user_has_permission(uuid, text);
drop function app_private.user_has_role(uuid, text);

commit;
