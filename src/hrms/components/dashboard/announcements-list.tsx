import Link from "next/link";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState } from "@/hrms/components/ui/page-title";
import type { AnnouncementRow } from "@/hrms/lib/data/self-service";
import { formatDateTime } from "@/hrms/lib/utils/format";

export function audienceLabel(a: Pick<AnnouncementRow, "audience" | "department">): string {
  if (a.audience === "DEPARTMENT") return a.department?.name ?? "Department";
  if (a.audience === "MANAGERS") return "Managers";
  return "Everyone";
}

export function AnnouncementsList({
  announcements,
  full = false,
}: {
  announcements: AnnouncementRow[];
  /** Show full text and no "View all" link (announcements page). */
  full?: boolean;
}) {
  return (
    <Card aria-labelledby="announcements-heading" className="h-full">
      <CardHeader
        titleId="announcements-heading"
        title={full ? "All announcements" : "Announcements"}
        action={
          full ? undefined : (
            <Link href="/hrms/announcements" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          )
        }
      />
      <CardBody className="py-2">
        {announcements.length === 0 ? (
          <EmptyState>There are no announcements for you right now.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {announcements.map((a) => (
              <li key={a.id} className="py-4">
                <article aria-labelledby={`announcement-${a.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.audience === "ALL" ? "brand" : "info"}>{audienceLabel(a)}</Badge>
                    {a.published_at ? (
                      <time dateTime={a.published_at} className="text-xs text-ink-subtle">
                        {formatDateTime(a.published_at)}
                      </time>
                    ) : null}
                  </div>
                  <h3 id={`announcement-${a.id}`} className="mt-2 text-sm font-semibold text-ink">
                    {a.title}
                  </h3>
                  <p
                    className={
                      full
                        ? "mt-1 whitespace-pre-line text-sm text-ink-muted"
                        : "mt-1 line-clamp-2 text-sm text-ink-muted"
                    }
                  >
                    {a.body}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
