import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState } from "@/hrms/components/ui/page-title";
import type { HolidayRow } from "@/hrms/lib/data/self-service";
import { daysBetween, formatDate } from "@/hrms/lib/utils/format";

export function UpcomingHolidays({
  holidays,
  today,
}: {
  holidays: HolidayRow[];
  today: string;
}) {
  return (
    <Card aria-labelledby="holidays-heading" className="h-full">
      <CardHeader
        titleId="holidays-heading"
        title="Upcoming holidays"
        action={
          <Link href="/hrms/holidays" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        }
      />
      <CardBody className="py-2">
        {holidays.length === 0 ? (
          <EmptyState>No upcoming holidays in the calendar.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {holidays.map((h) => {
              const days = daysBetween(today, h.holiday_date);
              return (
                <li key={h.id} className="flex items-center gap-4 py-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-line bg-slate-50 py-1.5">
                    <span className="text-[10px] font-semibold uppercase text-brand-700">
                      {formatDate(h.holiday_date, { month: "short" })}
                    </span>
                    <span className="text-lg font-semibold leading-none text-ink">
                      {formatDate(h.holiday_date, { day: "numeric" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                    <p className="text-xs text-ink-subtle">
                      <time dateTime={h.holiday_date}>
                        {formatDate(h.holiday_date, { weekday: "long", day: "numeric", month: "long" })}
                      </time>
                      {" · "}
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
