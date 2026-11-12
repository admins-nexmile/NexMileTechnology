import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { asRows, throwIfError } from "./errors";

/**
 * Payroll reads (migration 2.10). Payroll tables are not readable by any
 * API role; everything goes through SECURITY DEFINER functions that check
 * payroll.read / payroll.manage, or return only the caller's own payslips
 * from APPROVED or PAID runs that are not test data.
 */

export type PayrollRunStatus =
  | "DRAFT"
  | "PROCESSING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PAID"
  | "CANCELLED";

export type PayrollRun = {
  id: string;
  period_name: string;
  period_start: string;
  period_end: string;
  pay_date: string | null;
  status: PayrollRunStatus;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  item_count: number;
  test_item_count: number;
  total_gross: number;
  total_net: number;
};

export type PayrollItem = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  gross_earnings: number;
  pf_deduction: number;
  esi_deduction: number;
  professional_tax: number;
  tds_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  is_test_data: boolean;
};

export type PayslipSummary = {
  id: string;
  period_name: string;
  period_start: string;
  period_end: string;
  pay_date: string | null;
  run_status: "APPROVED" | "PAID";
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
};

export type Payslip = PayslipSummary & {
  employee_code: string;
  employee_name: string;
  designation: string;
  department: string | null;
  work_location: string | null;
  company_name: string | null;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  professional_tax: number;
  tds_deduction: number;
  other_deductions: number;
};

const NUMERIC_KEYS = [
  "item_count",
  "test_item_count",
  "total_gross",
  "total_net",
  "basic_salary",
  "hra",
  "other_allowances",
  "gross_earnings",
  "pf_deduction",
  "esi_deduction",
  "professional_tax",
  "tds_deduction",
  "other_deductions",
  "total_deductions",
  "net_pay",
];

function numbers<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of NUMERIC_KEYS) if (k in out && out[k] !== null) out[k] = Number(out[k]);
  return out as T;
}

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payroll_list_runs");
  throwIfError(error);
  return asRows<PayrollRun>(data).map(numbers);
}

export async function listPayrollItems(runId: string): Promise<PayrollItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payroll_list_items", { p_run_id: runId });
  throwIfError(error);
  return asRows<PayrollItem>(data).map(numbers);
}

export async function listMyPayslips(): Promise<PayslipSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_payslips");
  throwIfError(error);
  return asRows<PayslipSummary>(data).map(numbers);
}

/** Returns null when the payslip does not exist or is not the caller's. */
export async function getMyPayslip(id: string): Promise<Payslip | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_payslip", { p_id: id });
  if (error) return null;
  return data ? numbers(data as Payslip) : null;
}
