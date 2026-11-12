import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnnouncementsList } from "@/hrms/components/dashboard/announcements-list";
import { StatsGrid } from "@/hrms/components/dashboard/stats-grid";
import { TeamToday } from "@/hrms/components/dashboard/team-today";
import { UpcomingHolidays } from "@/hrms/components/dashboard/upcoming-holidays";
import { LeaveBalances } from "@/hrms/components/leave/leave-balances";
import { MyLeaveTable } from "@/hrms/components/leave/my-leave-table";
import { TodayAttendanceCard } from "@/hrms/components/self-service/today-attendance-card";
import { EnrollmentList } from "@/hrms/components/training/enrollment-list";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { PageSkeleton } from "@/hrms/components/ui/page-title";
import { canApproveLeave, requireActiveUser } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, ROLES, hasPermission, hasRole } from "@/hrms/lib/auth/permissions";
import type { ActiveUser } from "@/hrms/lib/auth/session";
import { getCompanyTotals } from "@/hrms/lib/data/company";
import {
  getHolidays,
  getMyAnnouncements,
  getMyAttendanceToday,
  getMyEnrollments,
  getMyLeaveBalances,
  getMyLeaveRequests,
} from "@/hrms/lib/data/self-service";
import { listMyPayslips } from "@/hrms/lib/data/payroll";
import { getMyTeam, getPendingApprovals } from "@/hrms/lib/data/team";
import type { StatSummary } from "@/hrms/lib/types/hrms";
import { addDays, todayIst } from "@/hrms/lib/utils/dates";
import { formatInr, formatLongDate, formatNumber } from "@/hrms/lib/utils/format";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading dashboard…" blocks={4} />}>
      <Dashboard />
    </Suspense>
  );
}

/**
 * Role-based dashboard. Every widget reads through the user's own session,
 * so RLS limits each query to what that user may see:
 *   - employee view (own data) for any account linked to an employee
 *   - "My team" for the manager role
 *   - company totals for employees.manage (HR Admin, Super Admin)
 */
async function Dashboard() {
  const user = await requireActiveUser();
  const today = todayIst();
  const roleKeys = user.roles.map((r) => r.key);
  const isManager = hasRole(roleKeys, ROLES.manager) && user.employeeId !== null;
  const showCompany = hasPermission(user.permissions, PERMISSIONS.employeesManage);
  const firstName = user.name.split(" ")[0] || user.name;

  const [holidays, announcements] = await Promise.all([
    getHolidays(today, addDays(today, 120)),
    getMyAnnouncements(5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-ink-subtle">
          <time dateTime={today}>{formatLongDate(today)}</time>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Welcome back, {firstName}
        </h1>
      </div>

      {showCompany ? <CompanySection today={today} /> : null}

      {user.employeeId ? (
        <EmployeeSection user={user} employeeId={user.employeeId} today={today} />
      ) : null}

      {isManager && user.employeeId ? (
        <ManagerSection user={user} employeeId={user.employeeId} today={today} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingHolidays holidays={holidays.slice(0, 5)} today={today} />
        <AnnouncementsList announcements={announcements} />
      </div>
    </div>
  );
}

async function CompanySection({ today }: { today: string }) {
  const totals = await getCompanyTotals(today);
  const stats: StatSummary[] = [
    {
      id: "employees",
      label: "Active employees",
      value: formatNumber(totals.activeEmployees),
      icon: "users",
      tone: "brand",
      detail: `${totals.joinedThisMonth} joined this month`,
    },
    {
      id: "present",
      label: "Present today",
      value: formatNumber(totals.presentToday),
      icon: "check",
      tone: "success",
      detail: `of ${formatNumber(totals.activeEmployees)} active employees`,
    },
    {
      id: "on-leave",
      label: "On leave today",
      value: formatNumber(totals.onLeaveToday),
      icon: "calendar",
      tone: "info",
      detail: "approved leave covering today",
    },
    {
      id: "pending",
      label: "Pending leave requests",
      value: formatNumber(totals.pendingLeave),
      icon: "clock",
      tone: "warning",
      detail: "awaiting a decision",
    },
  ];
  return <StatsGrid stats={stats} />;
}

async function EmployeeSection({
  employeeId,
  today,
}: {
  user: ActiveUser;
  employeeId: string;
  today: string;
}) {
  const year = Number(today.slice(0, 4));
  const [attendance, balances, requests, enrollments, payslips] = await Promise.all([
    getMyAttendanceToday(employeeId, today),
    getMyLeaveBalances(year),
    getMyLeaveRequests(employeeId, 5),
    getMyEnrollments(employeeId),
    listMyPayslips(),
  ]);
  const openTraining = enrollments.filter((e) => e.status === "ASSIGNED" || e.status === "IN_PROGRESS");
  const latestPayslip = payslips[0] ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TodayAttendanceCard today={today} record={attendance} />
        <LeaveBalances balances={balances} year={year} compact />
        <Card aria-labelledby="payslip-heading" className="h-full">
          <CardHeader
            titleId="payslip-heading"
            title="Latest payslip"
            action={
              <Link href="/hrms/payslips" className="text-sm font-medium text-brand-700 hover:underline">
                All payslips
              </Link>
            }
          />
          <div className="px-5 py-4 text-sm">
            {latestPayslip ? (
              <>
                <p className="text-ink-muted">{latestPayslip.period_name}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {formatInr(latestPayslip.net_pay)}
                </p>
                <Link
                  href={`/hrms/payslips/${latestPayslip.id}`}
                  className="mt-3 inline-block font-medium text-brand-700 hover:underline"
                >
                  View payslip
                </Link>
              </>
            ) : (
              <p className="text-ink-subtle">No payslip has been released to you yet.</p>
            )}
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card aria-labelledby="my-leave-heading">
          <CardHeader
            titleId="my-leave-heading"
            title="My leave requests"
            action={
              <Link href="/hrms/leave" className="text-sm font-medium text-brand-700 hover:underline">
                Apply or view all
              </Link>
            }
          />
          <MyLeaveTable requests={requests} allowCancel={false} />
        </Card>
        <Card aria-labelledby="my-training-heading">
          <CardHeader
            titleId="my-training-heading"
            title="My training"
            description={`${openTraining.length} open`}
            action={
              <Link href="/hrms/training" className="text-sm font-medium text-brand-700 hover:underline">
                View all
              </Link>
            }
          />
          <EnrollmentList enrollments={openTraining.slice(0, 5)} showActions={false} />
        </Card>
      </div>
    </>
  );
}

async function ManagerSection({
  user,
  employeeId,
  today,
}: {
  user: ActiveUser;
  employeeId: string;
  today: string;
}) {
  const [team, approvals] = await Promise.all([
    getMyTeam(employeeId, today),
    canApproveLeave(user) ? getPendingApprovals(employeeId, false) : Promise.resolve([]),
  ]);
  return <TeamToday team={team} pendingApprovals={approvals.length} />;
}
