import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/hrms/components/layout/app-shell";
import { loginErrorPath } from "@/hrms/lib/auth/errors";
import { getAccessState, roleLabel } from "@/hrms/lib/auth/session";

/**
 * Server-side guard for every dashboard route (defence in depth behind
 * proxy.ts). Must be rendered inside a <Suspense> boundary.
 *
 * Only users with an active profile and at least one role get the
 * dashboard; everyone else is redirected before anything renders.
 */
export async function DashboardAccessGate({ children }: { children: ReactNode }) {
  const access = await getAccessState();

  switch (access.status) {
    case "anonymous":
      redirect("/hrms/login");
    case "rejected":
      redirect(loginErrorPath(access.reason));
    case "pending":
      redirect("/hrms/access-pending");
  }

  return (
    <AppShell
      user={{ name: access.name, email: access.email, role: roleLabel(access) }}
      nav={{
        permissions: access.permissions,
        roleKeys: access.roles.map((r) => r.key),
        hasEmployee: access.employeeId !== null,
      }}
    >
      {children}
    </AppShell>
  );
}
