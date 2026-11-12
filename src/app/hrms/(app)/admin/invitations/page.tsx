import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CreateInvitationForm,
  type EmployeeOption,
} from "@/hrms/components/admin/invitations/create-invitation-form";
import { InvitationsTable } from "@/hrms/components/admin/invitations/invitations-table";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { Icon } from "@/hrms/components/ui/icons";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, ROLE_LABELS, invitableRolesFor } from "@/hrms/lib/auth/permissions";
import { listInvitableEmployees, listInvitations } from "@/hrms/lib/invitations/data";
import { getAppUrl } from "@/hrms/lib/utils/app-url";

export const metadata: Metadata = {
  title: "Invitations",
};

export default function InvitationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Invitations
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Give employees access to the HRMS. No emails are sent: tell the
          employee once their invitation is created.
        </p>
      </div>
      <Suspense fallback={<InvitationsSkeleton />}>
        <InvitationsContent />
      </Suspense>
    </div>
  );
}

async function InvitationsContent() {
  // Server-side permission check: 404 for anyone without invitations.manage.
  const user = await requirePagePermission(PERMISSIONS.invitationsManage);

  const [invitations, employees, appUrl] = await Promise.all([
    listInvitations(),
    listInvitableEmployees(),
    getAppUrl(),
  ]);

  const allowedRoles = invitableRolesFor(user.roles.map((r) => r.key));
  const roleOptions = allowedRoles.map((key) => ({ key, label: ROLE_LABELS[key] }));
  const employeeOptions: EmployeeOption[] = employees.map((e) => ({
    id: e.id,
    label: [e.employee_code, e.full_name].filter(Boolean).join(" — ") || e.work_email,
    workEmail: e.work_email,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-1 self-start">
        <CardHeader
          title="New invitation"
          description="The employee signs in with the invited Google account to accept."
        />
        <CardBody>
          <CreateInvitationForm employees={employeeOptions} roles={roleOptions} appUrl={appUrl} />
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
            <Icon name="info" className="mt-0.5 size-3.5 shrink-0" />
            Ask the employee to sign in at {appUrl} with the Google account HR
            invited. Invitations expire after 14 days. While the Google app is
            in Testing mode, also add that account as a Google test user.
          </p>
        </CardBody>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader
          title="All invitations"
          description="Pending, accepted, revoked and expired invitations."
        />
        <InvitationsTable invitations={invitations} revocableRoles={allowedRoles} />
      </Card>
    </div>
  );
}

function InvitationsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <span className="sr-only">Loading invitations…</span>
      <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-96 animate-pulse rounded-xl bg-slate-200 xl:col-span-2" />
    </div>
  );
}
