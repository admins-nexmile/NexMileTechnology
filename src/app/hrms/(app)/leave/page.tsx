import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApplyLeaveForm } from "@/hrms/components/leave/apply-leave-form";
import { ApprovalsTable } from "@/hrms/components/leave/approvals-table";
import { LeaveBalances } from "@/hrms/components/leave/leave-balances";
import { MyLeaveTable } from "@/hrms/components/leave/my-leave-table";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { canApproveLeave, requireActiveUser } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, hasPermission } from "@/hrms/lib/auth/permissions";
import { getActiveLeaveTypes, getMyLeaveBalances, getMyLeaveRequests } from "@/hrms/lib/data/self-service";
import { getPendingApprovals } from "@/hrms/lib/data/team";
import { todayIst } from "@/hrms/lib/utils/dates";

export const metadata: Metadata = { title: "Leave" };

export default function LeavePage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Leave" description="Apply for leave, track your requests and review your team's." />
      <Suspense fallback={<PageSkeleton label="Loading leave…" blocks={3} />}>
        <LeaveContent />
      </Suspense>
    </div>
  );
}

async function LeaveContent() {
  const user = await requireActiveUser();
  const approver = canApproveLeave(user);
  if (!user.employeeId && !approver) notFound();

  const today = todayIst();
  const year = Number(today.slice(0, 4));
  const canManageAll = hasPermission(user.permissions, PERMISSIONS.employeesManage);

  const [balances, types, requests, approvals] = await Promise.all([
    user.employeeId ? getMyLeaveBalances(year) : Promise.resolve([]),
    user.employeeId ? getActiveLeaveTypes() : Promise.resolve([]),
    user.employeeId ? getMyLeaveRequests(user.employeeId) : Promise.resolve([]),
    approver ? getPendingApprovals(user.employeeId, canManageAll) : Promise.resolve(null),
  ]);

  const balanceByType = new Map(balances.map((b) => [b.leave_type_id, b]));
  const typeChoices = types.map((t) => {
    const b = balanceByType.get(t.id);
    return {
      id: t.id,
      label: t.is_paid && b ? `${t.name} (${b.balance} of ${t.annual_allowance} left)` : `${t.name} (unpaid)`,
    };
  });

  return (
    <div className="space-y-6">
      {approvals ? (
        <Card id="approvals" aria-labelledby="approvals-heading">
          <CardHeader
            titleId="approvals-heading"
            title="Requests to review"
            description={
              canManageAll
                ? "Pending requests from all employees (except your own)."
                : "Pending requests from your direct reports."
            }
          />
          <ApprovalsTable approvals={approvals} />
        </Card>
      ) : null}

      {user.employeeId ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card aria-labelledby="apply-heading">
              <CardHeader titleId="apply-heading" title="Apply for leave" />
              <CardBody>
                <ApplyLeaveForm types={typeChoices} minDate={`${year}-01-01`} />
              </CardBody>
            </Card>
            <LeaveBalances balances={balances} year={year} />
          </div>
          <Card aria-labelledby="requests-heading">
            <CardHeader titleId="requests-heading" title="My requests" />
            <MyLeaveTable requests={requests} />
          </Card>
        </>
      ) : null}
    </div>
  );
}
