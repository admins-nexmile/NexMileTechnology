import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneForm } from "@/hrms/components/self-service/phone-form";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requireEmployeeUser } from "@/hrms/lib/auth/guards";
import { getMyProfile } from "@/hrms/lib/data/self-service";
import { formatDate } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "My profile" };

const LABELS: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  NOTICE_PERIOD: "Notice period",
  INACTIVE: "Inactive",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="My profile"
        description="Your employee record. Contact HR to correct anything other than your phone number."
      />
      <Suspense fallback={<PageSkeleton label="Loading profile…" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  await requireEmployeeUser();
  const p = await getMyProfile();

  const rows: [string, string][] = [
    ["Name", p.full_name],
    ["Employee code", p.employee_code],
    ["Department", p.department ?? "—"],
    ["Designation", p.designation],
    ["Manager", p.manager_name ? `${p.manager_name} (${p.manager_code})` : "—"],
    ["Hire date", formatDate(p.hire_date)],
    ["Work location", p.work_location ?? "—"],
    ["Employment type", LABELS[p.employment_type] ?? p.employment_type],
    ["Status", LABELS[p.employment_status] ?? p.employment_status],
    ["Work email", p.work_email],
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Employment details" />
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{label}</dt>
                <dd className="mt-1 break-words text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
      <Card className="self-start">
        <CardHeader title="Contact" description="The only detail you can change yourself." />
        <CardBody>
          <PhoneForm phone={p.phone} />
        </CardBody>
      </Card>
    </div>
  );
}
