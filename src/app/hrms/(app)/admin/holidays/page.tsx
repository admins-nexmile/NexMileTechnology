import type { Metadata } from "next";
import { Suspense } from "react";
import { deleteHolidayAction, saveHolidayAction } from "@/app/hrms/(app)/admin/hr-actions";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EditDisclosure } from "@/hrms/components/ui/edit-disclosure";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { getHolidays, type HolidayRow } from "@/hrms/lib/data/self-service";
import { todayIst } from "@/hrms/lib/utils/dates";
import { formatDate } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Manage holidays" };

function fields(h?: HolidayRow): FormField[] {
  return [
    { name: "name", label: "Name", type: "text", required: true, defaultValue: h?.name ?? "", maxLength: 100 },
    { name: "holiday_date", label: "Date", type: "date", required: true, defaultValue: h?.holiday_date ?? "" },
    { name: "location", label: "Location", type: "text", defaultValue: h?.location ?? "India", maxLength: 100, hint: "India applies to everyone; a city applies to that work location." },
    { name: "description", label: "Description", type: "textarea", defaultValue: h?.description ?? "", maxLength: 500 },
  ];
}

export default function ManageHolidaysPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Manage holidays" description="Holidays are excluded when leave days are counted." />
      <Suspense fallback={<PageSkeleton label="Loading holidays…" />}>
        <HolidaysContent />
      </Suspense>
    </div>
  );
}

async function HolidaysContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const year = Number(todayIst().slice(0, 4));
  const holidays = await getHolidays(`${year - 1}-01-01`, `${year + 1}-12-31`);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Holidays" description={`${year - 1} to ${year + 1}`} />
        {holidays.length === 0 ? (
          <EmptyState>No holidays yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {holidays.map((h) => (
              <li key={h.id} className="px-5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-ink">{h.name}</p>
                    <p className="text-xs text-ink-subtle">
                      {formatDate(h.holiday_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      {h.location ? ` · ${h.location}` : ""}
                    </p>
                  </div>
                  <ActionButton
                    action={deleteHolidayAction}
                    fields={{ id: h.id }}
                    pendingLabel="Deleting…"
                    confirmMessage={`Delete the holiday "${h.name}"? Leave already approved is not recalculated.`}
                    ariaLabel={`Delete holiday ${h.name}`}
                  >
                    Delete
                  </ActionButton>
                </div>
                <EditDisclosure label={h.name}>
                  <AdminForm action={saveHolidayAction} hidden={{ id: h.id }} fields={fields(h)} submitLabel="Save holiday" />
                </EditDisclosure>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHeader title="Add holiday" />
        <CardBody>
          <AdminForm action={saveHolidayAction} fields={fields()} submitLabel="Create holiday" />
        </CardBody>
      </Card>
    </div>
  );
}
