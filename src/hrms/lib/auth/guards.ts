import "server-only";
import { notFound, redirect } from "next/navigation";
import { loginErrorPath } from "./errors";
import { hasPermission, hasRole, ROLES, type PermissionKey } from "./permissions";
import { getAccessState, type ActiveUser } from "./session";

/**
 * Page guards. Each returns the active user or ends the request:
 * redirect for anonymous / rejected / pending users, 404 for active users
 * who may not use the page (so its existence is not revealed).
 * Must be called inside a <Suspense> boundary.
 */
export async function requireActiveUser(): Promise<ActiveUser> {
  const access = await getAccessState();
  switch (access.status) {
    case "anonymous":
      redirect("/hrms/login");
    case "rejected":
      redirect(loginErrorPath(access.reason));
    case "pending":
      redirect("/hrms/access-pending");
  }
  return access;
}

export async function requirePagePermission(permission: PermissionKey): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!hasPermission(user.permissions, permission)) notFound();
  return user;
}

export async function requireAnyPagePermission(
  permissions: readonly PermissionKey[],
): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!permissions.some((p) => hasPermission(user.permissions, p))) notFound();
  return user;
}

/** Self-service pages: the account must be linked to an employee record. */
export type EmployeeUser = ActiveUser & { employeeId: string };

export async function requireEmployeeUser(): Promise<EmployeeUser> {
  const user = await requireActiveUser();
  if (!user.employeeId) notFound();
  return user as EmployeeUser;
}

/**
 * For Server Actions: returns the active user if they hold `permission`,
 * or null. Actions must return an error instead of trusting the UI.
 */
export async function getUserWithPermission(
  permission: PermissionKey,
): Promise<ActiveUser | null> {
  const access = await getAccessState();
  if (access.status !== "active") return null;
  return hasPermission(access.permissions, permission) ? access : null;
}

/** For Server Actions: active user linked to an employee record, or null. */
export async function getEmployeeUser(): Promise<EmployeeUser | null> {
  const access = await getAccessState();
  if (access.status !== "active" || !access.employeeId) return null;
  return access as EmployeeUser;
}

/** Leave approvers: managers (own team) and employees.manage (everyone). */
export function canApproveLeave(user: Pick<ActiveUser, "roles" | "permissions">): boolean {
  return (
    hasRole(
      user.roles.map((r) => r.key),
      ROLES.manager,
    ) || hasPermission(user.permissions, "employees.manage")
  );
}
