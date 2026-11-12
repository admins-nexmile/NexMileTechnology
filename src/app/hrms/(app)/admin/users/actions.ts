"use server";

import { refresh } from "next/cache";
import { getUserWithPermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { NOT_ALLOWED, formString, isUuid, type ActionState } from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

const ROLE_KEYS = ["super_admin", "payroll_admin", "hr_admin", "manager", "employee"];

/**
 * Grants or revokes one role. Who may change which role is decided by
 * admin_set_user_role (super_admin: any; hr_admin: manager/employee on
 * plain accounts; never your own account; last super_admin protected).
 */
export async function setUserRoleAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUserWithPermission(PERMISSIONS.usersRead);
  if (!user) return NOT_ALLOWED;
  const target = formString(formData, "user_id");
  const role = formString(formData, "role");
  const grant = formString(formData, "grant") === "true";
  if (!isUuid(target) || !ROLE_KEYS.includes(role)) return { ok: false, message: "Invalid request." };
  if (target === user.userId) return { ok: false, message: "You cannot change your own roles." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: target,
    p_role: role,
    p_grant: grant,
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: grant ? "Role granted." : "Role removed." };
}

/** Suspends or reactivates an account (Super Admin only). */
export async function setUserStatusAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUserWithPermission(PERMISSIONS.rolesManage);
  if (!user) return NOT_ALLOWED;
  const target = formString(formData, "user_id");
  const status = formString(formData, "status");
  if (!isUuid(target) || (status !== "active" && status !== "suspended")) {
    return { ok: false, message: "Invalid request." };
  }
  if (target === user.userId) return { ok: false, message: "You cannot change your own account status." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: target, p_status: status });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: status === "suspended" ? "Account suspended." : "Account reactivated." };
}
