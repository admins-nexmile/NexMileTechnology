import { updateTrainingStatusAction } from "@/app/hrms/(app)/training/actions";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { Badge } from "@/hrms/components/ui/badge";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState } from "@/hrms/components/ui/page-title";
import type { MyEnrollment } from "@/hrms/lib/data/self-service";
import { formatDate } from "@/hrms/lib/utils/format";

/** The caller's training enrolments, with forward-only status buttons. */
export function EnrollmentList({
  enrollments,
  showActions = true,
}: {
  enrollments: MyEnrollment[];
  showActions?: boolean;
}) {
  if (enrollments.length === 0) return <EmptyState>You have no training assigned.</EmptyState>;

  return (
    <ul className="divide-y divide-line">
      {enrollments.map((e) => {
        const title = e.course?.title ?? "Course no longer available";
        return (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">
                {title}{" "}
                {e.course?.is_mandatory ? <Badge tone="warning">Mandatory</Badge> : null}
              </p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {[e.course?.category, e.course?.duration_hours ? `${e.course.duration_hours} h` : null]
                  .filter(Boolean)
                  .join(" · ")}
                {e.completed_at ? ` · completed ${formatDate(e.completed_at.slice(0, 10))}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge kind="training" status={e.status} />
              {showActions && e.course && e.status === "ASSIGNED" ? (
                <ActionButton
                  action={updateTrainingStatusAction}
                  fields={{ id: e.id, status: "IN_PROGRESS" }}
                  pendingLabel="Saving…"
                  ariaLabel={`Start ${title}`}
                >
                  Start
                </ActionButton>
              ) : null}
              {showActions && e.course && (e.status === "ASSIGNED" || e.status === "IN_PROGRESS") ? (
                <ActionButton
                  action={updateTrainingStatusAction}
                  fields={{ id: e.id, status: "COMPLETED" }}
                  pendingLabel="Saving…"
                  confirmMessage={`Mark "${title}" as completed? This cannot be undone.`}
                  ariaLabel={`Mark ${title} as completed`}
                >
                  Mark completed
                </ActionButton>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
