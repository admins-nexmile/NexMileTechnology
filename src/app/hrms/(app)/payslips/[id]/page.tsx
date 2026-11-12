import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/hrms/components/payroll/print-button";
import { PageSkeleton } from "@/hrms/components/ui/page-title";
import { isUuid } from "@/hrms/lib/actions/types";
import { requireEmployeeUser } from "@/hrms/lib/auth/guards";
import { getMyPayslip, type Payslip } from "@/hrms/lib/data/payroll";
import { formatDate, formatInr } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Payslip" };

export default function PayslipPage({ params }: PageProps<"/hrms/payslips/[id]">) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/hrms/payslips" className="text-sm font-medium text-brand-700 hover:underline">
          ← My payslips
        </Link>
        <PrintButton />
      </div>
      <Suspense fallback={<PageSkeleton label="Loading payslip…" blocks={1} />}>
        <PayslipContent params={params} />
      </Suspense>
    </div>
  );
}

function Rows({ rows }: { rows: [string, number][] }) {
  return (
    <tbody className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <tr key={label}>
          <th scope="row" className="py-2 text-left font-normal text-ink-muted">{label}</th>
          <td className="py-2 text-right tabular-nums text-ink">{formatInr(value)}</td>
        </tr>
      ))}
    </tbody>
  );
}

async function PayslipContent({ params }: { params: Promise<{ id: string }> }) {
  await requireEmployeeUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const p: Payslip | null = await getMyPayslip(id);
  if (!p) notFound();

  return (
    <article
      aria-labelledby="payslip-title"
      className="mx-auto max-w-3xl rounded-xl border border-line bg-surface p-6 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-lg font-semibold text-ink">{p.company_name ?? "Nexmile Technology"}</p>
          <h1 id="payslip-title" className="mt-1 text-sm text-ink-muted">
            Payslip for {p.period_name}
          </h1>
        </div>
        <div className="text-right text-sm text-ink-muted">
          <p>
            {formatDate(p.period_start)} – {formatDate(p.period_end)}
          </p>
          {p.pay_date ? <p>Pay date: {formatDate(p.pay_date)}</p> : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 border-b border-line py-4 text-sm sm:grid-cols-4">
        {[
          ["Employee", p.employee_name],
          ["Code", p.employee_code],
          ["Designation", p.designation],
          ["Department", p.department ?? "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2">
        <table className="w-full text-sm">
          <caption className="pb-2 text-left text-sm font-semibold text-ink">Earnings</caption>
          <Rows rows={[["Basic", p.basic_salary], ["HRA", p.hra], ["Other allowances", p.other_allowances]]} />
          <tfoot>
            <tr className="border-t border-line font-semibold">
              <th scope="row" className="py-2 text-left">Gross earnings</th>
              <td className="py-2 text-right tabular-nums">{formatInr(p.gross_earnings)}</td>
            </tr>
          </tfoot>
        </table>
        <table className="w-full text-sm">
          <caption className="pb-2 text-left text-sm font-semibold text-ink">Deductions</caption>
          <Rows
            rows={[
              ["Provident fund", p.pf_deduction],
              ["ESI", p.esi_deduction],
              ["Professional tax", p.professional_tax],
              ["TDS", p.tds_deduction],
              ["Other deductions", p.other_deductions],
            ]}
          />
          <tfoot>
            <tr className="border-t border-line font-semibold">
              <th scope="row" className="py-2 text-left">Total deductions</th>
              <td className="py-2 text-right tabular-nums">{formatInr(p.total_deductions)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
        <span className="text-sm font-semibold text-brand-800">Net pay</span>
        <span className="text-xl font-semibold tabular-nums text-brand-900">{formatInr(p.net_pay)}</span>
      </div>

      <p className="mt-4 text-xs text-ink-subtle">
        Computer-generated from amounts recorded by Payroll. Contact HR or Payroll with any questions.
      </p>
    </article>
  );
}
