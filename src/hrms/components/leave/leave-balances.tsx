import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState } from "@/hrms/components/ui/page-title";
import { ProgressBar } from "@/hrms/components/ui/progress-bar";
import type { LeaveBalance } from "@/hrms/lib/data/self-service";
import { formatNumber } from "@/hrms/lib/utils/format";

/** Balance = annual allowance minus approved days this calendar year. */
export function LeaveBalances({
  balances,
  year,
  compact = false,
}: {
  balances: LeaveBalance[];
  year: number;
  compact?: boolean;
}) {
  const paid = balances.filter((b) => b.is_paid);
  const shown = compact ? paid : balances;

  return (
    <Card aria-labelledby="leave-balance-heading" className="h-full">
      <CardHeader
        titleId="leave-balance-heading"
        title="Leave balance"
        description={`Calendar year ${year}: allowance minus approved days`}
      />
      <CardBody>
        {shown.length === 0 ? (
          <EmptyState>No leave types are configured.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {shown.map((b) => {
              const used = b.annual_allowance > 0 ? (b.approved_days / b.annual_allowance) * 100 : 0;
              return (
                <li key={b.leave_type_id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">
                      {b.name} <span className="text-ink-subtle">({b.code})</span>
                    </span>
                    <span className="text-ink-muted">
                      {b.is_paid ? (
                        <>
                          <strong className="text-ink">{formatNumber(b.balance)}</strong> of{" "}
                          {formatNumber(b.annual_allowance)} left
                        </>
                      ) : (
                        <>{formatNumber(b.approved_days)} taken (unpaid)</>
                      )}
                    </span>
                  </div>
                  {b.is_paid ? (
                    <ProgressBar
                      className="mt-1.5"
                      value={used}
                      label={`${b.name}: ${b.approved_days} of ${b.annual_allowance} days used`}
                    />
                  ) : null}
                  {b.pending_days > 0 ? (
                    <p className="mt-1 text-xs text-warning-700">
                      {formatNumber(b.pending_days)} day(s) pending approval
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
