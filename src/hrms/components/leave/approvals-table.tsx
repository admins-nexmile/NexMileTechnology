import { DecideLeaveForm } from "@/hrms/components/leave/decide-leave-form";
import { EmptyState } from "@/hrms/components/ui/page-title";
import type { PendingApproval } from "@/hrms/lib/data/team";
import { formatDate, formatNumber } from "@/hrms/lib/utils/format";

export function ApprovalsTable({ approvals }: { approvals: PendingApproval[] }) {
  if (approvals.length === 0) return <EmptyState>No leave requests are waiting for you.</EmptyState>;

  return (
    <ul className="divide-y divide-line">
      {approvals.map((a) => (
        <li key={a.id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1fr_18rem]">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-ink">
              {a.employee_name} <span className="text-ink-subtle">({a.employee_code})</span>
            </p>
            <p className="mt-0.5 text-ink-muted">
              {a.leave_type} · {formatNumber(a.total_days)} day(s) ·{" "}
              {a.start_date === a.end_date
                ? formatDate(a.start_date)
                : `${formatDate(a.start_date)} – ${formatDate(a.end_date)}`}
            </p>
            {a.reason ? <p className="mt-1 text-xs text-ink-subtle">“{a.reason}”</p> : null}
          </div>
          <DecideLeaveForm id={a.id} employee={a.employee_name} />
        </li>
      ))}
    </ul>
  );
}
