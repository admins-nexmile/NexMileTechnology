import Link from "next/link";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState } from "@/hrms/components/ui/page-title";
import type { TeamMember } from "@/hrms/lib/data/team";
import { formatTime } from "@/hrms/lib/utils/dates";

export function TeamToday({
  team,
  pendingApprovals,
}: {
  team: TeamMember[];
  pendingApprovals: number;
}) {
  const present = team.filter((m) => m.today?.check_in || m.today?.status === "PRESENT").length;

  return (
    <Card aria-labelledby="team-heading" className="h-full">
      <CardHeader
        titleId="team-heading"
        title="My team"
        description={`${present} of ${team.length} direct report(s) present today`}
        action={
          pendingApprovals > 0 ? (
            <Link href="/hrms/leave#approvals" className="text-sm font-medium text-brand-700 hover:underline">
              {pendingApprovals} leave request(s) to review
            </Link>
          ) : (
            <span className="text-sm text-ink-subtle">No leave to review</span>
          )
        }
      />
      <CardBody className="py-2">
        {team.length === 0 ? (
          <EmptyState>No direct reports are assigned to you.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {team.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{m.name}</p>
                  <p className="truncate text-xs text-ink-subtle">
                    {m.employee_code} · {m.designation}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {m.today ? (
                    <>
                      <StatusBadge kind="attendance" status={m.today.status} />
                      {m.today.check_in ? (
                        <p className="mt-0.5 text-xs text-ink-subtle">in {formatTime(m.today.check_in)}</p>
                      ) : null}
                    </>
                  ) : m.onLeaveToday ? (
                    <Badge tone="warning">On leave</Badge>
                  ) : (
                    <Badge>Not checked in</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
