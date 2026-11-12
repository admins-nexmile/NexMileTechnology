import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  deleteItemAction,
  setRunStatusAction,
  updateRunAction,
  upsertItemAction,
} from "@/app/hrms/(app)/payroll/actions";
import { PayrollRecordNotice } from "@/hrms/components/payroll/synthetic-notice";
import { StatusBadge } from "@/hrms/components/self-service/status-badge";
import { AdminForm, type FormField } from "@/hrms/components/ui/admin-form";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { EditDisclosure } from "@/hrms/components/ui/edit-disclosure";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState, PageSkeleton } from "@/hrms/components/ui/page-title";
import { isUuid } from "@/hrms/lib/actions/types";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS, hasPermission } from "@/hrms/lib/auth/permissions";
import { listEmployees } from "@/hrms/lib/data/admin";
import { listPayrollItems, listPayrollRuns, type PayrollItem, type PayrollRunStatus } from "@/hrms/lib/data/payroll";
import { formatDate, formatInr } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Payroll run" };

/** Mirrors payroll_set_run_status. */
const TRANSITIONS: Record<PayrollRunStatus, { to: PayrollRunStatus; label: string; primary?: boolean; confirm?: string }[]> = {
  DRAFT: [
    { to: "PROCESSING", label: "Start processing", primary: true },
    { to: "CANCELLED", label: "Cancel run", confirm: "Cancel this payroll run?" },
  ],
  PROCESSING: [
    { to: "PENDING_APPROVAL", label: "Submit for approval", primary: true, confirm: "Submit for approval? Items will be locked." },
    { to: "DRAFT", label: "Back to draft" },
    { to: "CANCELLED", label: "Cancel run", confirm: "Cancel this payroll run?" },
  ],
  PENDING_APPROVAL: [
    { to: "APPROVED", label: "Approve", primary: true, confirm: "Approve this run? Non-test payslips become visible to employees." },
    { to: "PROCESSING", label: "Send back" },
    { to: "CANCELLED", label: "Cancel run", confirm: "Cancel this payroll run?" },
  ],
  APPROVED: [{ to: "PAID", label: "Mark as paid", primary: true, confirm: "Mark this run as paid? This is final." }],
  PAID: [],
  CANCELLED: [],
};

const AMOUNTS: { key: keyof PayrollItem; label: string }[] = [
  { key: "basic_salary", label: "Basic" },
  { key: "hra", label: "HRA" },
  { key: "other_allowances", label: "Other allowances" },
  { key: "pf_deduction", label: "PF" },
  { key: "esi_deduction", label: "ESI" },
  { key: "professional_tax", label: "Professional tax" },
  { key: "tds_deduction", label: "TDS" },
  { key: "other_deductions", label: "Other deductions" },
];

function itemFields(employeeOptions: { value: string; label: string }[], item?: PayrollItem): FormField[] {
  return [
    ...(item
      ? []
      : [{ name: "employee_id", label: "Employee", type: "select" as const, required: true, emptyOption: "Select an employee…", options: employeeOptions, wide: true }]),
    ...AMOUNTS.map((a) => ({
      name: a.key,
      label: `${a.label} (₹)`,
      type: "number" as const,
      step: "0.01",
      min: "0",
      required: true,
      defaultValue: String(item ? item[a.key] : 0),
    })),
    {
      name: "is_test_data",
      label: "Test data (never shown to the employee)",
      type: "checkbox",
      defaultValue: item ? item.is_test_data : true,
      wide: true,
    },
  ];
}

export default function PayrollRunPage({ params }: PageProps<"/hrms/payroll/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/hrms/payroll" className="text-sm font-medium text-brand-700 hover:underline">
        ← All payroll runs
      </Link>
      <Suspense fallback={<PageSkeleton label="Loading payroll run…" />}>
        <RunContent params={params} />
      </Suspense>
    </div>
  );
}

async function RunContent({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission(PERMISSIONS.payrollRead);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const canManage = hasPermission(user.permissions, PERMISSIONS.payrollManage);

  const [runs, items, employees] = await Promise.all([
    listPayrollRuns(),
    listPayrollItems(id),
    canManage ? listEmployees() : Promise.resolve([]),
  ]);
  const run = runs.find((r) => r.id === id);
  if (!run) notFound();

  const editable = canManage && (run.status === "DRAFT" || run.status === "PROCESSING");
  const existing = new Set(items.map((i) => i.employee_id));
  const employeeOptions = employees
    .filter((e) => !existing.has(e.id) && e.id !== user.employeeId && e.employment_status !== "INACTIVE")
    .map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.name}` }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{run.period_name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDate(run.period_start)} – {formatDate(run.period_end)}
            {run.pay_date ? ` · pay date ${formatDate(run.pay_date)}` : ""}
          </p>
        </div>
        <StatusBadge kind="payroll" status={run.status} />
      </div>

      <PayrollRecordNotice />

      {canManage && TRANSITIONS[run.status].length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS[run.status].map((t) => (
            <ActionButton
              key={t.to}
              action={setRunStatusAction}
              fields={{ id: run.id, status: t.to }}
              variant={t.primary ? "primary" : "secondary"}
              size="md"
              pendingLabel="Updating…"
              confirmMessage={t.confirm}
            >
              {t.label}
            </ActionButton>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Items"
            description={`${items.length} employee(s) · gross ${formatInr(run.total_gross)} · net ${formatInr(run.total_net)}`}
          />
          {items.length === 0 ? (
            <EmptyState>No items yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">
                        {i.employee_name} <span className="text-ink-subtle">({i.employee_code})</span>{" "}
                        {i.is_test_data ? <Badge tone="warning">Test data</Badge> : null}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        Gross {formatInr(i.gross_earnings)} · deductions {formatInr(i.total_deductions)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-ink">{formatInr(i.net_pay)}</span>
                      {editable && i.employee_id !== user.employeeId ? (
                        <ActionButton
                          action={deleteItemAction}
                          fields={{ id: i.id }}
                          pendingLabel="Removing…"
                          confirmMessage={`Remove ${i.employee_name} from this run?`}
                          ariaLabel={`Remove ${i.employee_name}`}
                        >
                          Remove
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                  {editable && i.employee_id !== user.employeeId ? (
                    <EditDisclosure label={i.employee_name}>
                      <AdminForm
                        action={upsertItemAction}
                        hidden={{ run_id: run.id, employee_id: i.employee_id }}
                        fields={itemFields(employeeOptions, i)}
                        columns={2}
                        submitLabel="Save item"
                      />
                    </EditDisclosure>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6 self-start">
          {editable ? (
            <Card>
              <CardHeader title="Add employee" description="Totals are calculated by the server." />
              <CardBody>
                <AdminForm
                  action={upsertItemAction}
                  hidden={{ run_id: run.id }}
                  fields={itemFields(employeeOptions)}
                  columns={2}
                  submitLabel="Add item"
                />
              </CardBody>
            </Card>
          ) : null}
          {editable ? (
            <Card>
              <CardHeader title="Run details" />
              <CardBody>
                <AdminForm
                  action={updateRunAction}
                  hidden={{ id: run.id }}
                  fields={[
                    { name: "period_name", label: "Period name", type: "text", required: true, defaultValue: run.period_name, maxLength: 50 },
                    { name: "period_start", label: "Period start", type: "date", required: true, defaultValue: run.period_start },
                    { name: "period_end", label: "Period end", type: "date", required: true, defaultValue: run.period_end },
                    { name: "pay_date", label: "Pay date", type: "date", defaultValue: run.pay_date ?? "" },
                    { name: "notes", label: "Notes", type: "textarea", defaultValue: run.notes ?? "", maxLength: 500 },
                  ]}
                  submitLabel="Save run"
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="text-sm text-ink-muted">
                {run.status === "PENDING_APPROVAL"
                  ? "Items are locked while the run is pending approval. Send it back to edit."
                  : "This run can no longer be edited."}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
