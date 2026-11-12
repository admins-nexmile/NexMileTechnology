import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requireEmployeeUser } from "@/hrms/lib/auth/guards";
import { listMyPayslips } from "@/hrms/lib/data/payroll";
import { formatDate, formatInr } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "My payslips" };

export default function PayslipsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="My payslips" description="Payslips from approved or paid payroll runs." />
      <Suspense fallback={<PageSkeleton label="Loading payslips…" blocks={1} />}>
        <PayslipsContent />
      </Suspense>
    </div>
  );
}

async function PayslipsContent() {
  await requireEmployeeUser();
  const payslips = await listMyPayslips();
  return (
    <Card>
      <CardHeader title="Payslips" />
      {payslips.length === 0 ? (
        <EmptyState>No payslips have been released to you yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {payslips.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <Link href={`/hrms/payslips/${p.id}`} className="font-medium text-brand-700 hover:underline">
                  {p.period_name}
                </Link>
                <p className="text-xs text-ink-subtle">
                  {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  {p.pay_date ? ` · paid on ${formatDate(p.pay_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge kind="payroll" status={p.run_status} />
                <span className="font-semibold tabular-nums text-ink">{formatInr(p.net_pay)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
