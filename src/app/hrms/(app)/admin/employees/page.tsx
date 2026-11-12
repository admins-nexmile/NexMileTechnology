import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createEmployeeAction } from "@/app/hrms/(app)/admin/hr-actions";
import { Badge } from "@/hrms/components/ui/badge";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, labelFor } from "@/hrms/lib/admin/options";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { listDepartments, listEmployees } from "@/hrms/lib/data/admin";
import { todayIst } from "@/hrms/lib/utils/dates";

export const metadata: Metadata = { title: "Employees" };

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Employees"
        description="Employee records. Salary is managed separately by Payroll and never shown here."
      />
      <Suspense fallback={<PageSkeleton label="Loading employees…" />}>
        <EmployeesContent />
      </Suspense>
    </div>
  );
}

async function EmployeesContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const [employees, departments] = await Promise.all([listEmployees(), listDepartments()]);
  const managerOptions = employees
    .filter((e) => e.employment_status !== "INACTIVE")
    .map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.name}` }));

  const fields: FormField[] = [
    { name: "employee_code", label: "Employee code", type: "text", required: true, maxLength: 20, hint: "e.g. NX014" },
    { name: "hire_date", label: "Hire date", type: "date", required: true, defaultValue: todayIst() },
    { name: "first_name", label: "First name", type: "text", required: true, maxLength: 100 },
    { name: "middle_name", label: "Middle name", type: "text", maxLength: 100 },
    { name: "last_name", label: "Last name", type: "text", required: true, maxLength: 100 },
    { name: "work_email", label: "Work email", type: "email", required: true, hint: "Used to match the Google sign-in when inviting." },
    { name: "phone", label: "Phone", type: "tel", maxLength: 20 },
    { name: "designation", label: "Designation", type: "text", required: true, maxLength: 150 },
    { name: "employment_type", label: "Employment type", type: "select", required: true, options: EMPLOYMENT_TYPES, defaultValue: "FULL_TIME" },
    { name: "employment_status", label: "Status", type: "select", required: true, options: EMPLOYMENT_STATUSES, defaultValue: "ACTIVE" },
    { name: "department_id", label: "Department", type: "select", emptyOption: "No department", options: departments.map((d) => ({ value: d.id, label: d.name })) },
    { name: "manager_id", label: "Manager", type: "select", emptyOption: "No manager", options: managerOptions },
    { name: "work_location", label: "Work location", type: "text", defaultValue: "Bengaluru", maxLength: 100 },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2" aria-labelledby="employees-heading">
        <CardHeader titleId="employees-heading" title="All employees" description={`${employees.length} record(s)`} />
        {employees.length === 0 ? (
          <EmptyState>No employees yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Employees</caption>
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Code</th>
                  <th scope="col" className="px-5 py-2 font-medium">Name</th>
                  <th scope="col" className="px-5 py-2 font-medium">Department</th>
                  <th scope="col" className="px-5 py-2 font-medium">Designation</th>
                  <th scope="col" className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-2.5 font-mono text-xs text-ink-muted">{e.employee_code}</td>
                    <td className="px-5 py-2.5">
                      <Link href={`/hrms/admin/employees/${e.id}`} className="font-medium text-brand-700 hover:underline">
                        {e.name}
                      </Link>
                      <p className="text-xs text-ink-subtle">{e.work_email}</p>
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">{e.department ?? "—"}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{e.designation}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={e.employment_status === "ACTIVE" ? "success" : e.employment_status === "INACTIVE" ? "neutral" : "warning"}>
                        {labelFor(EMPLOYMENT_STATUSES, e.employment_status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="self-start" aria-labelledby="new-employee-heading">
        <CardHeader titleId="new-employee-heading" title="Add employee" />
        <CardBody>
          <AdminForm action={createEmployeeAction} fields={fields} submitLabel="Create employee" />
        </CardBody>
      </Card>
    </div>
  );
}
