import type { Metadata } from "next";
import { Suspense } from "react";
import { saveAnnouncementAction } from "@/app/hrms/(app)/admin/hr-actions";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EditDisclosure } from "@/hrms/components/ui/edit-disclosure";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { AUDIENCES, labelFor, toIstLocalInput } from "@/hrms/lib/admin/options";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { listAllAnnouncements, listDepartments, type AdminAnnouncement, type Department } from "@/hrms/lib/data/admin";
import { formatDateTime } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Manage announcements" };

function fields(departments: Department[], a?: AdminAnnouncement): FormField[] {
  return [
    { name: "title", label: "Title", type: "text", required: true, defaultValue: a?.title ?? "", maxLength: 200, wide: true },
    { name: "body", label: "Message", type: "textarea", required: true, defaultValue: a?.body ?? "", maxLength: 5000 },
    { name: "audience", label: "Audience", type: "select", required: true, options: AUDIENCES, defaultValue: a?.audience ?? "ALL" },
    { name: "department_id", label: "Department", type: "select", emptyOption: "—", options: departments.map((d) => ({ value: d.id, label: d.name })), defaultValue: a?.department_id ?? "", hint: "Only for “One department”." },
    { name: "published_at", label: "Publish from (IST)", type: "datetime-local", defaultValue: toIstLocalInput(a?.published_at ?? null), hint: "Empty = now, when published." },
    { name: "expires_at", label: "Expires (IST)", type: "datetime-local", defaultValue: toIstLocalInput(a?.expires_at ?? null) },
    { name: "is_published", label: "Published", type: "checkbox", defaultValue: a?.is_published ?? false, wide: true },
  ];
}

function state(a: AdminAnnouncement, nowIso: string): { label: string; tone: "success" | "neutral" | "warning" | "info" } {
  if (!a.is_published) return { label: "Draft", tone: "neutral" };
  if (a.expires_at && a.expires_at <= nowIso) return { label: "Expired", tone: "warning" };
  if (a.published_at && a.published_at > nowIso) return { label: "Scheduled", tone: "info" };
  return { label: "Live", tone: "success" };
}

export default function ManageAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Manage announcements" description="Drafts are visible only to HR. Unpublish to withdraw an announcement." />
      <Suspense fallback={<PageSkeleton label="Loading announcements…" />}>
        <AnnouncementsContent />
      </Suspense>
    </div>
  );
}

async function AnnouncementsContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const [announcements, departments] = await Promise.all([listAllAnnouncements(), listDepartments()]);
  const nowIso = new Date().toISOString();
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader title="Announcements" />
        {announcements.length === 0 ? (
          <EmptyState>No announcements yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {announcements.map((a) => {
              const s = state(a, nowIso);
              return (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <Badge>
                      {a.audience === "DEPARTMENT"
                        ? deptName.get(a.department_id ?? "") ?? "Department"
                        : labelFor(AUDIENCES, a.audience)}
                    </Badge>
                    {a.published_at ? <span className="text-xs text-ink-subtle">{formatDateTime(a.published_at)}</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{a.title}</p>
                  <p className="line-clamp-2 text-sm text-ink-muted">{a.body}</p>
                  <EditDisclosure label={a.title}>
                    <AdminForm action={saveAnnouncementAction} hidden={{ id: a.id }} fields={fields(departments, a)} columns={2} submitLabel="Save announcement" />
                  </EditDisclosure>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="self-start xl:col-span-2">
        <CardHeader title="New announcement" />
        <CardBody>
          <AdminForm action={saveAnnouncementAction} fields={fields(departments)} submitLabel="Save announcement" />
        </CardBody>
      </Card>
    </div>
  );
}
