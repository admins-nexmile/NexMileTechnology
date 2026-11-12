import type { Metadata } from "next";
import { Suspense } from "react";
import { saveLeaveTypeAction } from "@/app/hrms/(app)/admin/hr-actions";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EditDisclosure } from "@/hrms/components/ui/edit-disclosure";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { listAllLeaveTypes, type AdminLeaveType } from "@/hrms/lib/data/admin";

export const metadata: Metadata = { title: "Leave types" };

function fields(t?: AdminLeaveType): FormField[] {
  return [
    { name: "name", label: "Name", type: "text", required: true, defaultValue: t?.name ?? "", maxLength: 100 },
    { name: "code", label: "Code", type: "text", required: true, defaultValue: t?.code ?? "", maxLength: 10, hint: "1–10 capital letters, e.g. CL" },
    { name: "annual_allowance", label: "Days per calendar year", type: "number", required: true, step: "0.5", min: "0", max: "365", defaultValue: String(t?.annual_allowance ?? 0) },
    { name: "is_paid", label: "Paid leave (balance is enforced)", type: "checkbox", defaultValue: t?.is_paid ?? true },
    { name: "requires_approval", label: "Requires approval", type: "checkbox", defaultValue: t?.requires_approval ?? true },
    { name: "is_active", label: "Active (employees can apply)", type: "checkbox", defaultValue: t?.is_active ?? true },
  ];
}

export default function LeaveTypesPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Leave types" description="Leave categories and yearly allowances. Deactivate instead of deleting." />
      <Suspense fallback={<PageSkeleton label="Loading leave types…" />}>
        <LeaveTypesContent />
      </Suspense>
    </div>
  );
}

async function LeaveTypesContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const types = await listAllLeaveTypes();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="All leave types" />
        {types.length === 0 ? (
          <EmptyState>No leave types yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {types.map((t) => (
              <li key={t.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-ink">{t.name}</span>
                  <span className="font-mono text-xs text-ink-subtle">{t.code}</span>
                  <Badge tone={t.is_paid ? "brand" : "neutral"}>{t.is_paid ? `${t.annual_allowance} days/yr` : "Unpaid"}</Badge>
                  {!t.requires_approval ? <Badge tone="info">No approval</Badge> : null}
                  {!t.is_active ? <Badge>Inactive</Badge> : null}
                </div>
                <EditDisclosure label={t.name}>
                  <AdminForm action={saveLeaveTypeAction} hidden={{ id: t.id }} fields={fields(t)} submitLabel="Save leave type" />
                </EditDisclosure>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHeader title="Add leave type" />
        <CardBody>
          <AdminForm action={saveLeaveTypeAction} fields={fields()} submitLabel="Create leave type" />
        </CardBody>
      </Card>
    </div>
  );
}
