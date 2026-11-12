"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithPermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { NOT_ALLOWED, formString, isIsoDate, isUuid, type ActionState } from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/**
 * Payroll actions (migration 2.10). payroll.manage is checked here for a
 * clear message; the database functions enforce it, the status workflow,
 * the item lock and the "never your own item" rule.
 */

const STATUSES = ["DRAFT", "PROCESSING", "PENDING_APPROVAL", "APPROVED", "PAID", "CANCELLED"];
const AMOUNT_FIELDS = [
  "basic_salary",
  "hra",
  "other_allowances",
  "pf_deduction",
  "esi_deduction",
  "professional_tax",
  "tds_deduction",
  "other_deductions",
] as const;

async function requirePayroll() {
  return getUserWithPermission(PERMISSIONS.payrollManage);
}

function runFields(formData: FormData) {
  return {
    name: formString(formData, "period_name"),
    start: formString(formData, "period_start"),
    end: formString(formData, "period_end"),
    pay: formString(formData, "pay_date"),
    notes: formString(formData, "notes"),
  };
}

export async function createRunAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requirePayroll())) return NOT_ALLOWED;
  const f = runFields(formData);
  if (!isIsoDate(f.start) || !isIsoDate(f.end)) return { ok: false, message: "Enter valid period dates." };
  if (f.pay && !isIsoDate(f.pay)) return { ok: false, message: "Enter a valid pay date." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payroll_create_run", {
    p_period_name: f.name,
    p_start: f.start,
    p_end: f.end,
    p_pay_date: f.pay || null,
    p_notes: f.notes || null,
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  redirect(`/hrms/payroll/${data as string}`);
}

export async function updateRunAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requirePayroll())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  const f = runFields(formData);
  if (!isUuid(id)) return { ok: false, message: "Invalid payroll run." };
  if (!isIsoDate(f.start) || !isIsoDate(f.end)) return { ok: false, message: "Enter valid period dates." };
  if (f.pay && !isIsoDate(f.pay)) return { ok: false, message: "Enter a valid pay date." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("payroll_update_run", {
    p_id: id,
    p_period_name: f.name,
    p_start: f.start,
    p_end: f.end,
    p_pay_date: f.pay || null,
    p_notes: f.notes || null,
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Run details saved." };
}

export async function setRunStatusAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requirePayroll())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  const status = formString(formData, "status");
  if (!isUuid(id) || !STATUSES.includes(status)) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("payroll_set_run_status", { p_id: id, p_status: status });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Run status updated." };
}

export async function upsertItemAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requirePayroll())) return NOT_ALLOWED;
  const runId = formString(formData, "run_id");
  const employeeId = formString(formData, "employee_id");
  if (!isUuid(runId) || !isUuid(employeeId)) return { ok: false, message: "Choose an employee." };

  const amounts: Record<string, number> = {};
  for (const key of AMOUNT_FIELDS) {
    const raw = formString(formData, key) || "0";
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || Math.round(n * 100) !== n * 100) {
      return { ok: false, message: "Amounts must be zero or positive, with at most two decimals." };
    }
    amounts[key] = n;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("payroll_upsert_item", {
    p_run_id: runId,
    p_employee_id: employeeId,
    p_basic: amounts.basic_salary,
    p_hra: amounts.hra,
    p_other_allowances: amounts.other_allowances,
    p_pf: amounts.pf_deduction,
    p_esi: amounts.esi_deduction,
    p_pt: amounts.professional_tax,
    p_tds: amounts.tds_deduction,
    p_other_deductions: amounts.other_deductions,
    p_is_test_data: formData.get("is_test_data") === "on",
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Payroll item saved. Totals were calculated by the server." };
}

export async function deleteItemAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requirePayroll())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid payroll item." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("payroll_delete_item", { p_id: id });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Payroll item removed." };
}
