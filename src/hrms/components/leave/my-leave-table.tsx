import { cancelLeaveAction } from "@/app/hrms/(app)/leave/actions";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState } from "@/hrms/components/ui/page-title";
import type { MyLeaveRequest } from "@/hrms/lib/data/self-service";
import { formatDate, formatNumber } from "@/hrms/lib/utils/format";

function range(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** The caller's own leave requests; pending ones can be cancelled. */
export function MyLeaveTable({
  requests,
  allowCancel = true,
}: {
  requests: MyLeaveRequest[];
  allowCancel?: boolean;
}) {
  if (requests.length === 0) return <EmptyState>You have no leave requests yet.</EmptyState>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">My leave requests</caption>
        <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
          <tr>
            <th scope="col" className="px-5 py-2 font-medium">Dates</th>
            <th scope="col" className="px-5 py-2 font-medium">Type</th>
            <th scope="col" className="px-5 py-2 font-medium">Days</th>
            <th scope="col" className="px-5 py-2 font-medium">Status</th>
            {allowCancel ? (
              <th scope="col" className="px-5 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requests.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-5 py-3 text-ink">
                {range(r.start_date, r.end_date)}
                {r.reason ? <p className="mt-0.5 text-xs text-ink-subtle">{r.reason}</p> : null}
              </td>
              <td className="px-5 py-3 text-ink-muted">{r.leave_type?.name ?? "—"}</td>
              <td className="px-5 py-3 text-ink-muted">{formatNumber(r.total_days)}</td>
              <td className="px-5 py-3">
                <StatusBadge kind="leave" status={r.status} />
                {r.decision_note ? (
                  <p className="mt-1 text-xs text-ink-subtle">“{r.decision_note}”</p>
                ) : null}
              </td>
              {allowCancel ? (
                <td className="px-5 py-3 text-right">
                  {r.status === "PENDING" ? (
                    <ActionButton
                      action={cancelLeaveAction}
                      fields={{ id: r.id }}
                      pendingLabel="Cancelling…"
                      confirmMessage="Cancel this leave request?"
                      ariaLabel={`Cancel leave request ${range(r.start_date, r.end_date)}`}
                    >
                      Cancel
                    </ActionButton>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
