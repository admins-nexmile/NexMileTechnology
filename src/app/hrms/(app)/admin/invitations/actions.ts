"use server";

import { refresh } from "next/cache";
import { isValidEmail } from "@/hrms/lib/auth/email-policy";
import { getUserWithPermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, invitableRolesFor, isInvitableRole } from "@/hrms/lib/auth/permissions";
import { toUserMessage } from "@/hrms/lib/invitations/data";
import { createClient } from "@/hrms/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_PERMISSION: ActionState = {
  ok: false,
  message: "You do not have permission to manage invitations.",
};

/**
 * Creates an invitation. The permission and the role matrix are checked
 * here for a clear message, and again by the database function, which is
 * the actual enforcement point.
 */
export async function createInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUserWithPermission(PERMISSIONS.invitationsManage);
  if (!user) return NO_PERMISSION;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role");
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!UUID_RE.test(employeeId)) {
    return { ok: false, message: "Select an employee." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!isInvitableRole(role) || !invitableRolesFor(user.roles.map((r) => r.key)).includes(role)) {
    return { ok: false, message: "You are not allowed to invite users with that role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invitation", {
    p_email: email,
    p_role_key: role,
    p_employee_id: employeeId,
  });
  if (error) return { ok: false, message: toUserMessage(error) };

  refresh();
  return { ok: true, message: `Invitation created for ${email}.` };
}

/** Revokes a pending invitation (permission re-checked in the database). */
export async function revokeInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUserWithPermission(PERMISSIONS.invitationsManage);
  if (!user) return NO_PERMISSION;

  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { ok: false, message: "Invalid invitation." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_id: id });
  if (error) return { ok: false, message: toUserMessage(error) };

  refresh();
  return { ok: true, message: "Invitation revoked." };
}
