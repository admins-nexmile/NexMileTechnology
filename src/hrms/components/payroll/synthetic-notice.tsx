import { Icon } from "@/hrms/components/ui/icons";

/** Required notice: amounts are entered manually, not statutory calculations. */
export function PayrollRecordNotice() {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg border border-info-100 bg-info-50 px-4 py-3 text-sm text-info-700"
    >
      <Icon name="info" className="mt-0.5 size-4 shrink-0" />
      Amounts are entered by Payroll. This system records them and computes totals; it does not
      calculate PF, ESI, professional tax or TDS and is not a verified statutory payroll engine.
    </p>
  );
}
