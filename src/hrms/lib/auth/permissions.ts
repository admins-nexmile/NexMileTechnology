/**
 * Permission keys, role helpers and invitation rules shared by server code
 * and UI.
 *
 * These mirror the database (migrations 2.1, 2.3 and later), which is the
 * real enforcement point. The UI uses them only to decide what to show.
 */
export const PERMISSIONS = {
  usersRead: "users.read",
  rolesManage: "roles.manage",
  invitationsManage: "invitations.manage",
  employeesReadAll: "employees.read_all",
  employeesManage: "employees.manage",
  compensationRead: "compensation.read",
  compensationManage: "compensation.manage",
  payrollRead: "payroll.read",
  payrollManage: "payroll.manage",
  payslipsReadAll: "payslips.read_all",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  superAdmin: "super_admin",
  payrollAdmin: "payroll_admin",
  hrAdmin: "hr_admin",
  manager: "manager",
  employee: "employee",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export function hasPermission(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(permission);
}

export function hasRole(roleKeys: readonly string[], role: RoleKey): boolean {
  return roleKeys.includes(role);
}

/** Roles that can ever be granted by invitation (never super_admin). */
export const INVITABLE_ROLES = ["payroll_admin", "hr_admin", "manager", "employee"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<InvitableRole, string> = {
  payroll_admin: "Payroll Admin",
  hr_admin: "HR Admin",
  manager: "Manager",
  employee: "Employee",
};

/**
 * Roles the caller may invite: super_admin → all invitable roles;
 * hr_admin → manager and employee; anyone else → none.
 */
export function invitableRolesFor(roleKeys: readonly string[]): InvitableRole[] {
  if (roleKeys.includes("super_admin")) return [...INVITABLE_ROLES];
  if (roleKeys.includes("hr_admin")) return ["manager", "employee"];
  return [];
}

export function isInvitableRole(value: unknown): value is InvitableRole {
  return typeof value === "string" && (INVITABLE_ROLES as readonly string[]).includes(value);
}
