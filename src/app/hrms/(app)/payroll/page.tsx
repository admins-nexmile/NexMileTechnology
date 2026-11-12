import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createRunAction } from "@/app/hrms/(app)/payroll/actions";
import { PayrollRecordNotice } from "@/hrms/components/payroll/synthetic-notice";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { AdminForm } from "@/hrms/components/ui/admin-form";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, hasPermission } from "@/hrms/lib/auth/permissions";
import { listPayrollRuns } from "@/hrms/lib/data/payroll";
import { formatDate, formatInr } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Payroll" description="Payroll runs: draft → processing → pending approval → approved → paid." />
      <Suspense fallback={<PageSkeleton label="Loading payroll…" />}>
        <PayrollContent />
      </Suspense>
    </div>
  );
}

async function PayrollContent() {
  const user = await requirePagePermission(PERMISSIONS.payrollRead);
  const canManage = hasPermission(user.permissions, PERMISSIONS.payrollManage);
  const runs = await listPayrollRuns();

  return (
    <div className="space-y-6">
      <PayrollRecordNotice />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Payroll runs" />
          {runs.length === 0 ? (
            <EmptyState>No payroll runs yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Payroll runs</caption>
                <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th scope="col" className="px-5 py-2 font-medium">Period</th>
                    <th scope="col" className="px-5 py-2 font-medium">Status</th>
                    <th scope="col" className="px-5 py-2 font-medium">Items</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Net total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5">
                        <Link href={`/hrms/payroll/${r.id}`} className="font-medium text-brand-700 hover:underline">
                          {r.period_name}
                        </Link>
                        <p className="text-xs text-ink-subtle">
                          {formatDate(r.period_start)} – {formatDate(r.period_end)}
                        </p>
                      </td>
                      <td className="px-5 py-2.5">
                        <StatusBadge kind="payroll" status={r.status} />
                      </td>
                      <td className="px-5 py-2.5 text-ink-muted">
                        {r.item_count}
                        {r.test_item_count > 0 ? (
                          <span className="ml-1 text-xs text-warning-700">({r.test_item_count} test)</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-ink">{formatInr(r.total_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {canManage ? (
          <Card className="self-start">
            <CardHeader title="New payroll run" />
            <CardBody>
              <AdminForm
                action={createRunAction}
                fields={[
                  { name: "period_name", label: "Period name", type: "text", required: true, maxLength: 50, hint: "e.g. December 2026" },
                  { name: "period_start", label: "Period start", type: "date", required: true },
                  { name: "period_end", label: "Period end", type: "date", required: true },
                  { name: "pay_date", label: "Pay date", type: "date" },
                  { name: "notes", label: "Notes", type: "textarea", maxLength: 500 },
                ]}
                submitLabel="Create run"
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
