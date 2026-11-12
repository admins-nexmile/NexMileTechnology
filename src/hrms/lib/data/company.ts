import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { throwIfError } from "./errors";

/**
 * Company-wide totals for HR Admin / Super Admin dashboards. These read
 * real rows through RLS (employees.read_all); callers must also check
 * employees.manage before showing them.
 */
export type CompanyTotals = {
  activeEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  pendingLeave: number;
  joinedThisMonth: number;
};

export async function getCompanyTotals(today: string): Promise<CompanyTotals> {
  const supabase = await createClient();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [active, present, onLeave, pending, joined] = await Promise.all([
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .neq("employment_status", "INACTIVE"),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("attendance_date", today)
      .in("status", ["PRESENT", "HALF_DAY"]),
    supabase
      .from("leave_requests")
      .select("employee_id", { count: "exact", head: true })
      .eq("status", "APPROVED")
      .lte("start_date", today)
      .gte("end_date", today),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .gte("hire_date", monthStart)
      .lte("hire_date", today),
  ]);

  for (const r of [active, present, onLeave, pending, joined]) throwIfError(r.error);

  return {
    activeEmployees: active.count ?? 0,
    presentToday: present.count ?? 0,
    onLeaveToday: onLeave.count ?? 0,
    pendingLeave: pending.count ?? 0,
    joinedThisMonth: joined.count ?? 0,
  };
}
