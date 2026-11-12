import { PERMISSIONS, ROLES, hasPermission, hasRole } from "@/hrms/lib/auth/permissions";
import type { NavContext, NavSection } from "@/hrms/lib/types/hrms";

/**
 * Sidebar navigation, built from the signed-in user's roles and
 * permissions. Items the user cannot use are not rendered at all. This is
 * presentation only: every page and server action re-checks access on the
 * server, and the database enforces it again (RLS + functions).
 */
const isEmployee = (c: NavContext) => c.hasEmployee;
const can = (permission: string) => (c: NavContext) => hasPermission(c.permissions, permission);

export const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", icon: "dashboard", href: "/hrms", show: () => true }],
  },
  {
    title: "My workspace",
    items: [
      { label: "My profile", icon: "user", href: "/hrms/profile", show: isEmployee },
      { label: "Attendance", icon: "clock", href: "/hrms/attendance", show: isEmployee },
      {
        label: "Leave",
        icon: "calendar",
        href: "/hrms/leave",
        show: (c) =>
          c.hasEmployee ||
          hasRole(c.roleKeys, ROLES.manager) ||
          hasPermission(c.permissions, PERMISSIONS.employeesManage),
      },
      { label: "Holidays", icon: "sun", href: "/hrms/holidays", show: () => true },
      { label: "Announcements", icon: "megaphone", href: "/hrms/announcements", show: () => true },
      { label: "Training", icon: "graduation", href: "/hrms/training", show: isEmployee },
      { label: "My payslips", icon: "wallet", href: "/hrms/payslips", show: isEmployee },
      { label: "My documents", icon: "file", href: "/hrms/documents", show: isEmployee },
    ],
  },
  {
    title: "Payroll",
    items: [{ label: "Payroll runs", icon: "wallet", href: "/hrms/payroll", show: can(PERMISSIONS.payrollRead) }],
  },
  {
    title: "HR administration",
    items: [
      { label: "Employees", icon: "users", href: "/hrms/admin/employees", show: can(PERMISSIONS.employeesManage) },
      { label: "Departments", icon: "building", href: "/hrms/admin/departments", show: can(PERMISSIONS.employeesManage) },
      { label: "Leave types", icon: "tag", href: "/hrms/admin/leave-types", show: can(PERMISSIONS.employeesManage) },
      { label: "Manage holidays", icon: "sun", href: "/hrms/admin/holidays", show: can(PERMISSIONS.employeesManage) },
      { label: "Manage announcements", icon: "megaphone", href: "/hrms/admin/announcements", show: can(PERMISSIONS.employeesManage) },
      { label: "Manage training", icon: "graduation", href: "/hrms/admin/training", show: can(PERMISSIONS.employeesManage) },
      { label: "Manage documents", icon: "file", href: "/hrms/admin/documents", show: can(PERMISSIONS.employeesManage) },
    ],
  },
  {
    title: "Access",
    items: [
      { label: "Users and roles", icon: "shield", href: "/hrms/admin/users", show: can(PERMISSIONS.usersRead) },
      {
        label: "Invitations",
        icon: "userPlus",
        href: "/hrms/admin/invitations",
        show: can(PERMISSIONS.invitationsManage),
      },
      {
        label: "Audit log",
        icon: "list",
        href: "/hrms/admin/audit",
        show: (c) => hasRole(c.roleKeys, ROLES.superAdmin),
      },
    ],
  },
];

/** Drops items the user may not use, then any empty sections. */
export function visibleNavigation(context: NavContext): NavSection[] {
  return navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => item.show(context)) }))
    .filter((section) => section.items.length > 0);
}
