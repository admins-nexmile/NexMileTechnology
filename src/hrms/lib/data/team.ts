import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { throwIfError } from "./errors";

/**
 * Manager and approver reads. RLS limits managers to their direct reports
 * (manager role + employees.manager_id) and gives employees.read_all users
 * everyone; the queries below narrow further where the UI needs it.
 */

export type TeamMember = {
  id: string;
  employee_code: string;
  name: string;
  designation: string;
  today: { status: string; check_in: string | null; check_out: string | null } | null;
  onLeaveToday: boolean;
};

export type PendingApproval = {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  applied_at: string;
  leave_type: string;
  employee_code: string;
  employee_name: string;
};

type EmployeeLite = {
  id: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  designation: string;
};

export function fullName(e: Pick<EmployeeLite, "first_name" | "middle_name" | "last_name">): string {
  return [e.first_name, e.middle_name, e.last_name].filter((p) => p && p.trim()).join(" ");
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Direct reports of `managerEmployeeId` with today's attendance. */
export async function getMyTeam(managerEmployeeId: string, today: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("employees")
    .select("id, employee_code, first_name, middle_name, last_name, designation")
    .eq("manager_id", managerEmployeeId)
    .neq("employment_status", "INACTIVE")
    .order("first_name");
  throwIfError(error);
  const team = (members ?? []) as EmployeeLite[];
  if (team.length === 0) return [];

  const ids = team.map((m) => m.id);
  const [{ data: att, error: attError }, { data: leave, error: leaveError }] = await Promise.all([
    supabase
      .from("attendance")
      .select("employee_id, status, check_in, check_out")
      .eq("attendance_date", today)
      .in("employee_id", ids),
    supabase
      .from("leave_requests")
      .select("employee_id")
      .eq("status", "APPROVED")
      .lte("start_date", today)
      .gte("end_date", today)
      .in("employee_id", ids),
  ]);
  throwIfError(attError);
  throwIfError(leaveError);

  const byEmployee = new Map((att ?? []).map((a) => [a.employee_id as string, a]));
  const onLeave = new Set((leave ?? []).map((l) => l.employee_id as string));

  return team.map((m) => {
    const a = byEmployee.get(m.id);
    return {
      id: m.id,
      employee_code: m.employee_code,
      name: fullName(m),
      designation: m.designation,
      today: a ? { status: a.status, check_in: a.check_in, check_out: a.check_out } : null,
      onLeaveToday: onLeave.has(m.id),
    };
  });
}

/**
 * Pending leave the caller may decide: everyone else's when they hold
 * employees.manage, otherwise only their direct reports'. Never their own.
 */
export async function getPendingApprovals(
  myEmployeeId: string | null,
  canManageAll: boolean,
): Promise<PendingApproval[]> {
  if (!canManageAll && !myEmployeeId) return [];
  const supabase = await createClient();
  let query = supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, total_days, reason, applied_at, leave_type:leave_types(name), employee:employees!leave_requests_employee_id_fkey!inner(id, employee_code, first_name, middle_name, last_name, manager_id)",
    )
    .eq("status", "PENDING")
    .order("start_date");
  if (myEmployeeId) query = query.neq("employee_id", myEmployeeId);
  if (!canManageAll && myEmployeeId) query = query.eq("employee.manager_id", myEmployeeId);

  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []).flatMap((r) => {
    const emp = one(r.employee as unknown as (EmployeeLite & { manager_id: string | null }) | null);
    const lt = one(r.leave_type as unknown as { name: string } | null);
    if (!emp) return [];
    return [
      {
        id: r.id as string,
        start_date: r.start_date as string,
        end_date: r.end_date as string,
        total_days: Number(r.total_days),
        reason: (r.reason as string | null) ?? null,
        applied_at: r.applied_at as string,
        leave_type: lt?.name ?? "Leave",
        employee_code: emp.employee_code,
        employee_name: fullName(emp),
      },
    ];
  });
}
