import type { Metadata } from "next";
import { Suspense } from "react";
import { saveDepartmentAction } from "@/app/hrms/(app)/admin/hr-actions";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EditDisclosure } from "@/hrms/components/ui/edit-disclosure";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { listDepartments } from "@/hrms/lib/data/admin";

export const metadata: Metadata = { title: "Departments" };

function fields(name = "", description: string | null = ""): FormField[] {
  return [
    { name: "name", label: "Name", type: "text", required: true, defaultValue: name, maxLength: 100 },
    { name: "description", label: "Description", type: "textarea", defaultValue: description, maxLength: 500 },
  ];
}

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Departments" description="Departments used for employees and announcements." />
      <Suspense fallback={<PageSkeleton label="Loading departments…" />}>
        <DepartmentsContent />
      </Suspense>
    </div>
  );
}

async function DepartmentsContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const departments = await listDepartments();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="All departments" description={`${departments.length} department(s)`} />
        {departments.length === 0 ? (
          <EmptyState>No departments yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {departments.map((d) => (
              <li key={d.id} className="px-5 py-3">
                <p className="text-sm font-medium text-ink">{d.name}</p>
                {d.description ? <p className="text-xs text-ink-subtle">{d.description}</p> : null}
                <EditDisclosure label={d.name}>
                  <AdminForm action={saveDepartmentAction} hidden={{ id: d.id }} fields={fields(d.name, d.description)} submitLabel="Save department" />
                </EditDisclosure>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHeader title="Add department" />
        <CardBody>
          <AdminForm action={saveDepartmentAction} fields={fields()} submitLabel="Create department" />
        </CardBody>
      </Card>
    </div>
  );
}
