import type { Metadata } from "next";
import { Suspense } from "react";
import { cancelEnrollmentAction, enrollAction, saveCourseAction } from "@/app/hrms/(app)/admin/hr-actions";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EditDisclosure } from "@/hrms/components/ui/edit-disclosure";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { listAllCourses, listAllEnrollments, listEmployees, type AdminCourse } from "@/hrms/lib/data/admin";

export const metadata: Metadata = { title: "Manage training" };

function courseFields(c?: AdminCourse): FormField[] {
  return [
    { name: "title", label: "Title", type: "text", required: true, defaultValue: c?.title ?? "", maxLength: 200 },
    { name: "category", label: "Category", type: "text", defaultValue: c?.category ?? "", maxLength: 100 },
    { name: "duration_hours", label: "Duration (hours)", type: "number", step: "0.5", min: "0", max: "1000", defaultValue: String(c?.duration_hours ?? 1) },
    { name: "description", label: "Description", type: "textarea", defaultValue: c?.description ?? "", maxLength: 2000 },
    { name: "is_mandatory", label: "Mandatory", type: "checkbox", defaultValue: c?.is_mandatory ?? false },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: c?.is_active ?? true },
  ];
}

export default function ManageTrainingPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Manage training" description="Courses and who is enrolled. Employees update their own progress." />
      <Suspense fallback={<PageSkeleton label="Loading training…" />}>
        <TrainingContent />
      </Suspense>
    </div>
  );
}

async function TrainingContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const [courses, enrollments, employees] = await Promise.all([
    listAllCourses(),
    listAllEnrollments(),
    listEmployees(),
  ]);
  const employeeName = new Map(employees.map((e) => [e.id, `${e.employee_code} — ${e.name}`]));
  const activeEmployees = employees
    .filter((e) => e.employment_status !== "INACTIVE")
    .map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.name}` }));
  const activeCourses = courses.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.title }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {courses.length === 0 ? (
          <Card>
            <EmptyState>No courses yet.</EmptyState>
          </Card>
        ) : (
          courses.map((c) => {
            const list = enrollments.filter((e) => e.course_id === c.id);
            const done = list.filter((e) => e.status === "COMPLETED").length;
            const open = list.filter((e) => e.status !== "CANCELLED").length;
            return (
              <Card key={c.id} aria-labelledby={`course-${c.id}`}>
                <CardHeader
                  titleId={`course-${c.id}`}
                  title={c.title}
                  description={`${done} of ${open} completed${c.category ? ` · ${c.category}` : ""}`}
                  action={
                    <div className="flex gap-2">
                      {c.is_mandatory ? <Badge tone="warning">Mandatory</Badge> : null}
                      {!c.is_active ? <Badge>Inactive</Badge> : null}
                    </div>
                  }
                />
                <CardBody>
                  {list.length === 0 ? (
                    <p className="text-sm text-ink-subtle">No one is enrolled.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {list.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <span className="text-ink">{employeeName.get(e.employee_id) ?? "Unknown employee"}</span>
                          <span className="flex items-center gap-2">
                            <StatusBadge kind="training" status={e.status} />
                            {e.status === "ASSIGNED" || e.status === "IN_PROGRESS" ? (
                              <ActionButton
                                action={cancelEnrollmentAction}
                                fields={{ id: e.id }}
                                pendingLabel="Cancelling…"
                                confirmMessage="Cancel this enrolment?"
                                ariaLabel={`Cancel enrolment of ${employeeName.get(e.employee_id) ?? "employee"}`}
                              >
                                Cancel
                              </ActionButton>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <EditDisclosure label={c.title}>
                    <AdminForm action={saveCourseAction} hidden={{ id: c.id }} fields={courseFields(c)} submitLabel="Save course" />
                  </EditDisclosure>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
      <div className="space-y-6 self-start">
        <Card>
          <CardHeader title="Enrol an employee" />
          <CardBody>
            <AdminForm
              action={enrollAction}
              fields={[
                { name: "course_id", label: "Course", type: "select", required: true, emptyOption: "Select a course…", options: activeCourses },
                { name: "employee_id", label: "Employee", type: "select", required: true, emptyOption: "Select an employee…", options: activeEmployees },
              ]}
              submitLabel="Enrol"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="New course" />
          <CardBody>
            <AdminForm action={saveCourseAction} fields={courseFields()} submitLabel="Create course" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
