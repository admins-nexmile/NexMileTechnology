import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamToday } from "@/hrms/components/dashboard/team-today";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { TodayAttendanceCard } from "@/hrms/components/self-service/today-attendance-card";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { canApproveLeave, requireEmployeeUser } from "@/hrms/lib/auth/guards";
import { ROLES, hasRole } from "@/hrms/lib/auth/permissions";
import { getMyAttendance } from "@/hrms/lib/data/self-service";
import { getMyTeam, getPendingApprovals } from "@/hrms/lib/data/team";
import { addDays, formatMinutes, formatTime, todayIst } from "@/hrms/lib/utils/dates";
import { formatDate } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Attendance" description="Check in and out for today and review your last 30 days." />
      <Suspense fallback={<PageSkeleton label="Loading attendance…" />}>
        <AttendanceContent />
      </Suspense>
    </div>
  );
}

async function AttendanceContent() {
  const user = await requireEmployeeUser();
  const today = todayIst();
  const isManager = hasRole(user.roles.map((r) => r.key), ROLES.manager);

  const [history, team, approvals] = await Promise.all([
    getMyAttendance(user.employeeId, addDays(today, -30), today),
    isManager ? getMyTeam(user.employeeId, today) : Promise.resolve(null),
    isManager && canApproveLeave(user) ? getPendingApprovals(user.employeeId, false) : Promise.resolve([]),
  ]);
  const todayRow = history.find((r) => r.attendance_date === today) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TodayAttendanceCard today={today} record={todayRow} />
        {team ? <TeamToday team={team} pendingApprovals={approvals.length} /> : null}
      </div>

      <Card aria-labelledby="history-heading">
        <CardHeader titleId="history-heading" title="Last 30 days" />
        {history.length === 0 ? (
          <EmptyState>No attendance recorded in the last 30 days.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">My attendance for the last 30 days</caption>
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Date</th>
                  <th scope="col" className="px-5 py-2 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2 font-medium">Check in</th>
                  <th scope="col" className="px-5 py-2 font-medium">Check out</th>
                  <th scope="col" className="px-5 py-2 font-medium">Worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2.5 text-ink">
                      {formatDate(r.attendance_date, { weekday: "short", day: "numeric", month: "short" })}
                    </td>
                    <td className="px-5 py-2.5">
                      <StatusBadge kind="attendance" status={r.status} />
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">{formatTime(r.check_in)}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{formatTime(r.check_out)}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{formatMinutes(r.work_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
