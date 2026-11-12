import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requireActiveUser } from "@/hrms/lib/auth/guards";
import { getHolidays } from "@/hrms/lib/data/self-service";
import { todayIst } from "@/hrms/lib/utils/dates";
import { formatDate } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Holidays" };

export default function HolidaysPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Holidays" description="Company holidays for this year and next." />
      <Suspense fallback={<PageSkeleton label="Loading holidays…" blocks={1} />}>
        <HolidaysContent />
      </Suspense>
    </div>
  );
}

async function HolidaysContent() {
  await requireActiveUser();
  const today = todayIst();
  const year = Number(today.slice(0, 4));
  const holidays = await getHolidays(`${year}-01-01`, `${year + 1}-12-31`);
  const years = [year, year + 1];

  return (
    <div className="space-y-6">
      {years.map((y) => {
        const list = holidays.filter((h) => h.holiday_date.startsWith(String(y)));
        if (y !== year && list.length === 0) return null;
        return (
          <Card key={y} aria-labelledby={`holidays-${y}`}>
            <CardHeader titleId={`holidays-${y}`} title={`${y}`} description={`${list.length} holiday(s)`} />
            {list.length === 0 ? (
              <EmptyState>No holidays have been published for {y}.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((h) => {
                  const past = h.holiday_date < today;
                  return (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div className={past ? "opacity-60" : undefined}>
                        <p className="text-sm font-medium text-ink">{h.name}</p>
                        <p className="text-xs text-ink-subtle">
                          <time dateTime={h.holiday_date}>
                            {formatDate(h.holiday_date, { weekday: "long", day: "numeric", month: "long" })}
                          </time>
                          {h.description ? ` · ${h.description}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.location ? <Badge>{h.location}</Badge> : null}
                        {h.holiday_date === today ? <Badge tone="success">Today</Badge> : null}
                        {past ? <span className="text-xs text-ink-subtle">Past</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
