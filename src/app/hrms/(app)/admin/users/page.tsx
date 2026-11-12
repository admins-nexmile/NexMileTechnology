import type { Metadata } from "next";
import { Suspense } from "react";
import { setUserRoleAction, setUserStatusAction } from "@/app/hrms/(app)/admin/users/actions";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, hasPermission } from "@/hrms/lib/auth/permissions";
import { listUsers, type AdminUser } from "@/hrms/lib/data/admin";

export const metadata: Metadata = { title: "Users and roles" };

const ROLE_NAMES: Record<string, string> = {
  super_admin: "Super Admin",
  payroll_admin: "Payroll Admin",
  hr_admin: "HR Admin",
  manager: "Manager",
  employee: "Employee",
};
const ALL_ROLES = Object.keys(ROLE_NAMES);

/** Mirrors admin_set_user_role so only usable buttons are shown. */
function assignableRoles(callerRoles: string[], target: AdminUser): string[] {
  if (callerRoles.includes("super_admin")) return ALL_ROLES;
  if (callerRoles.includes("hr_admin") && target.roles.every((r) => r === "manager" || r === "employee")) {
    return ["manager", "employee"];
  }
  return [];
}

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Users and roles"
        description="Accounts that have accepted an invitation. You cannot change your own roles or status."
      />
      <Suspense fallback={<PageSkeleton label="Loading users…" blocks={1} />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}

async function UsersContent() {
  const me = await requirePagePermission(PERMISSIONS.usersRead);
  const users = await listUsers();
  const myRoles = me.roles.map((r) => r.key);
  const canSuspend = hasPermission(me.permissions, PERMISSIONS.rolesManage);

  return (
    <Card>
      <CardHeader
        title="Accounts"
        description={
          canSuspend
            ? "Super Admin: any role; at least one active Super Admin must remain."
            : "HR Admin: Manager and Employee roles on employee accounts only."
        }
      />
      {users.length === 0 ? (
        <EmptyState>No accounts yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {users.map((u) => {
            const self = u.user_id === me.userId;
            const assignable = self ? [] : assignableRoles(myRoles, u);
            return (
              <li key={u.user_id} className="grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-ink">
                    {u.employee_name ?? u.full_name ?? u.email}
                    {self ? <span className="ml-2 text-xs text-ink-subtle">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-ink-subtle">
                    {u.email}
                    {u.employee_code ? ` · ${u.employee_code}` : " · not linked to an employee"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={u.status === "active" ? "success" : u.status === "suspended" ? "danger" : "neutral"}>
                      {u.status}
                    </Badge>
                    {u.roles.map((r) => (
                      <Badge key={r} tone="brand">
                        {ROLE_NAMES[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                  {assignable.map((role) => {
                    const has = u.roles.includes(role);
                    return (
                      <ActionButton
                        key={role}
                        action={setUserRoleAction}
                        fields={{ user_id: u.user_id, role, grant: String(!has) }}
                        pendingLabel="Saving…"
                        confirmMessage={`${has ? "Remove" : "Grant"} ${ROLE_NAMES[role]} ${has ? "from" : "to"} ${u.email}?`}
                        ariaLabel={`${has ? "Remove" : "Grant"} ${ROLE_NAMES[role]} for ${u.email}`}
                        variant={has ? "secondary" : "ghost"}
                      >
                        {has ? `− ${ROLE_NAMES[role]}` : `+ ${ROLE_NAMES[role]}`}
                      </ActionButton>
                    );
                  })}
                  {canSuspend && !self && u.status !== "pending" ? (
                    <ActionButton
                      action={setUserStatusAction}
                      fields={{ user_id: u.user_id, status: u.status === "active" ? "suspended" : "active" }}
                      pendingLabel="Saving…"
                      confirmMessage={u.status === "active" ? `Suspend ${u.email}? They lose access immediately.` : `Reactivate ${u.email}?`}
                      ariaLabel={`${u.status === "active" ? "Suspend" : "Reactivate"} ${u.email}`}
                    >
                      {u.status === "active" ? "Suspend" : "Reactivate"}
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
