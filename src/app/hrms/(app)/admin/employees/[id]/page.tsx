import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setOrganisationAction, updateEmployeeAction } from "@/app/hrms/(app)/admin/hr-actions";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { PageSkeleton } from "@/hrms/components/ui/page-title";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from "@/hrms/lib/admin/options";
import { isUuid } from "@/hrms/lib/actions/types";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { getEmployee, listDepartments, listEmployees } from "@/hrms/lib/data/admin";

export const metadata: Metadata = { title: "Edit employee" };

export default function EditEmployeePage({ params }: PageProps<"/hrms/admin/employees/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/hrms/admin/employees" className="text-sm font-medium text-brand-700 hover:underline">
        ← All employees
      </Link>
      <Suspense fallback={<PageSkeleton label="Loading employee…" />}>
        <EditEmployee params={params} />
      </Suspense>
    </div>
  );
}

async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission(PERMISSIONS.employeesManage);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [employee, departments, employees] = await Promise.all([
    getEmployee(id),
    listDepartments(),
    listEmployees(),
  ]);
  if (!employee) notFound();
  const isSelf = user.employeeId === employee.id;

  const details: FormField[] = [
    { name: "employee_code", label: "Employee code", type: "text", required: true, defaultValue: employee.employee_code, maxLength: 20 },
    { name: "hire_date", label: "Hire date", type: "date", required: true, defaultValue: employee.hire_date },
    { name: "first_name", label: "First name", type: "text", required: true, defaultValue: employee.first_name, maxLength: 100 },
    { name: "middle_name", label: "Middle name", type: "text", defaultValue: employee.middle_name, maxLength: 100 },
    { name: "last_name", label: "Last name", type: "text", required: true, defaultValue: employee.last_name, maxLength: 100 },
    { name: "work_email", label: "Work email", type: "email", required: true, defaultValue: employee.work_email },
    { name: "phone", label: "Phone", type: "tel", defaultValue: employee.phone, maxLength: 20 },
    { name: "designation", label: "Designation", type: "text", required: true, defaultValue: employee.designation, maxLength: 150 },
    { name: "employment_type", label: "Employment type", type: "select", required: true, options: EMPLOYMENT_TYPES, defaultValue: employee.employment_type },
    { name: "work_location", label: "Work location", type: "text", defaultValue: employee.work_location, maxLength: 100 },
  ];

  // Managers: anyone non-inactive except this employee (cycles are rejected by the database).
  const managerOptions = employees
    .filter((e) => e.id !== employee.id && e.employment_status !== "INACTIVE")
    .map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.name}` }));

  const organisation: FormField[] = [
    { name: "department_id", label: "Department", type: "select", emptyOption: "No department", options: departments.map((d) => ({ value: d.id, label: d.name })), defaultValue: employee.department_id ?? "" },
    { name: "manager_id", label: "Manager", type: "select", emptyOption: "No manager", options: managerOptions, defaultValue: employee.manager_id ?? "", hint: "Team access also needs the Manager role (Users page)." },
    { name: "employment_status", label: "Employment status", type: "select", required: true, options: EMPLOYMENT_STATUSES, defaultValue: employee.employment_status },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{employee.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {employee.employee_code} · {employee.designation}
        </p>
      </div>
      {isSelf ? (
        <p role="note" className="rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          This is your own record. Administrators cannot change their own record; ask another administrator.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Details" />
            <CardBody>
              <AdminForm
                action={updateEmployeeAction}
                hidden={{ id: employee.id }}
                fields={details}
                columns={2}
                submitLabel="Save details"
              />
            </CardBody>
          </Card>
          <Card className="self-start">
            <CardHeader title="Organisation" />
            <CardBody>
              <AdminForm
                action={setOrganisationAction}
                hidden={{
                  id: employee.id,
                  orig_department_id: employee.department_id ?? "",
                  orig_manager_id: employee.manager_id ?? "",
                  orig_employment_status: employee.employment_status,
                }}
                fields={organisation}
                submitLabel="Save organisation"
              />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
