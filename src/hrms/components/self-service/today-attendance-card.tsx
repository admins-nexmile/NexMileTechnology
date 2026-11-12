import { checkInAction, checkOutAction } from "@/app/hrms/(app)/attendance/actions";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { ActionButton } from "@/hrms/components/ui/form";
import { Icon } from "@/hrms/components/ui/icons";
import type { AttendanceRow } from "@/hrms/lib/data/self-service";
import { formatMinutes, formatTime } from "@/hrms/lib/utils/dates";
import { formatLongDate } from "@/hrms/lib/utils/format";

/** Today's attendance with check-in / check-out for the signed-in employee. */
export function TodayAttendanceCard({
  today,
  record,
}: {
  today: string;
  record: AttendanceRow | null;
}) {
  const checkedIn = Boolean(record?.check_in);
  const checkedOut = Boolean(record?.check_out);

  return (
    <Card aria-labelledby="today-attendance-heading" className="h-full">
      <CardHeader
        titleId="today-attendance-heading"
        title="Today's attendance"
        description={formatLongDate(today)}
        action={record ? <StatusBadge kind="attendance" status={record.status} /> : undefined}
      />
      <CardBody>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-ink-subtle">Check in</dt>
            <dd className="mt-1 font-semibold text-ink">{formatTime(record?.check_in)}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Check out</dt>
            <dd className="mt-1 font-semibold text-ink">{formatTime(record?.check_out)}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Worked</dt>
            <dd className="mt-1 font-semibold text-ink">{formatMinutes(record?.work_minutes)}</dd>
          </div>
        </dl>
        <div className="mt-5">
          {!checkedIn ? (
            <ActionButton action={checkInAction} variant="primary" size="md" pendingLabel="Checking in…">
              <Icon name="clock" className="size-4" />
              Check in
            </ActionButton>
          ) : !checkedOut ? (
            <ActionButton
              action={checkOutAction}
              size="md"
              pendingLabel="Checking out…"
              confirmMessage="Check out for today? You cannot check in again today."
            >
              <Icon name="logout" className="size-4" />
              Check out
            </ActionButton>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success-700">
              <Icon name="check" className="size-4" />
              You have checked out for today.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
