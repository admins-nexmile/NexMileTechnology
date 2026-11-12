import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { asRows, throwIfError } from "./errors";

/**
 * Self-service reads (migrations 2.6 / 2.8). Every query runs as the
 * signed-in user: RLS and the SECURITY DEFINER functions decide what is
 * returned. Queries also filter by the caller's own employee id so that a
 * manager or HR user sees only their own rows on self-service pages.
 */

export type MyProfile = {
  id: string;
  employee_code: string;
  full_name: string;
  first_name: string;
  work_email: string;
  phone: string | null;
  designation: string;
  department: string | null;
  manager_name: string | null;
  manager_code: string | null;
  hire_date: string;
  work_location: string | null;
  employment_type: string;
  employment_status: string;
};

export type LeaveBalance = {
  leave_type_id: string;
  code: string;
  name: string;
  is_paid: boolean;
  annual_allowance: number;
  approved_days: number;
  pending_days: number;
  balance: number;
};

export type LeaveTypeOption = {
  id: string;
  name: string;
  code: string;
  is_paid: boolean;
  annual_allowance: number;
};

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type MyLeaveRequest = {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: LeaveStatus;
  reason: string | null;
  decision_note: string | null;
  applied_at: string;
  decided_at: string | null;
  leave_type: { name: string; code: string } | null;
};

export type AttendanceRow = {
  id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  work_minutes: number;
};

export type HolidayRow = {
  id: string;
  name: string;
  holiday_date: string;
  location: string | null;
  description: string | null;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: "ALL" | "DEPARTMENT" | "MANAGERS";
  published_at: string | null;
  department: { name: string } | null;
};

export type TrainingStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type MyEnrollment = {
  id: string;
  status: TrainingStatus;
  assigned_at: string;
  completed_at: string | null;
  course: {
    title: string;
    category: string | null;
    duration_hours: number | null;
    is_mandatory: boolean;
  } | null;
};

export type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_hours: number | null;
  is_mandatory: boolean;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getMyProfile(): Promise<MyProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_profile");
  throwIfError(error);
  return data as MyProfile;
}

export async function getMyLeaveBalances(year?: number): Promise<LeaveBalance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_leave_balances", { p_year: year ?? null });
  throwIfError(error);
  return asRows<LeaveBalance>(data).map((b) => ({
    ...b,
    annual_allowance: Number(b.annual_allowance),
    approved_days: Number(b.approved_days),
    pending_days: Number(b.pending_days),
    balance: Number(b.balance),
  }));
}

export async function getActiveLeaveTypes(): Promise<LeaveTypeOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_types")
    .select("id, name, code, is_paid, annual_allowance")
    .eq("is_active", true)
    .order("name");
  throwIfError(error);
  return (data ?? []).map((t) => ({ ...t, annual_allowance: Number(t.annual_allowance) }));
}

export async function getMyLeaveRequests(employeeId: string, limit = 50): Promise<MyLeaveRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, total_days, status, reason, decision_note, applied_at, decided_at, leave_type:leave_types(name, code)",
    )
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data ?? []).map((r) => ({
    ...(r as unknown as MyLeaveRequest),
    total_days: Number(r.total_days),
    leave_type: one(r.leave_type as MyLeaveRequest["leave_type"] | MyLeaveRequest["leave_type"][]),
  }));
}

export async function getMyAttendance(
  employeeId: string,
  fromDate: string,
  toDate: string,
): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, attendance_date, check_in, check_out, status, work_minutes")
    .eq("employee_id", employeeId)
    .gte("attendance_date", fromDate)
    .lte("attendance_date", toDate)
    .order("attendance_date", { ascending: false });
  throwIfError(error);
  return (data ?? []) as AttendanceRow[];
}

export async function getMyAttendanceToday(
  employeeId: string,
  today: string,
): Promise<AttendanceRow | null> {
  const rows = await getMyAttendance(employeeId, today, today);
  return rows[0] ?? null;
}

export async function getHolidays(fromDate: string, toDate: string): Promise<HolidayRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("id, name, holiday_date, location, description")
    .gte("holiday_date", fromDate)
    .lte("holiday_date", toDate)
    .order("holiday_date");
  throwIfError(error);
  return (data ?? []) as HolidayRow[];
}

/**
 * Published announcements inside their publish window. RLS already limits
 * employees to ALL / their department / MANAGERS (manager role); the
 * explicit filters keep drafts out of HR users' self-service views too.
 */
export async function getMyAnnouncements(limit = 50): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, audience, published_at, department:departments(name)")
    .eq("is_published", true)
    .lte("published_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
    .order("published_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data ?? []).map((a) => ({
    ...(a as unknown as AnnouncementRow),
    department: one(a.department as AnnouncementRow["department"] | AnnouncementRow["department"][]),
  }));
}

export async function getMyEnrollments(employeeId: string): Promise<MyEnrollment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_enrollments")
    .select(
      "id, status, assigned_at, completed_at, course:training_courses(title, category, duration_hours, is_mandatory)",
    )
    .eq("employee_id", employeeId)
    .order("assigned_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((e) => {
    const course = one(e.course as MyEnrollment["course"] | MyEnrollment["course"][]);
    return {
      ...(e as unknown as MyEnrollment),
      course: course ? { ...course, duration_hours: course.duration_hours === null ? null : Number(course.duration_hours) } : null,
    };
  });
}

export async function getActiveCourses(): Promise<CourseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_courses")
    .select("id, title, description, category, duration_hours, is_mandatory")
    .eq("is_active", true)
    .order("is_mandatory", { ascending: false })
    .order("title");
  throwIfError(error);
  return (data ?? []).map((c) => ({
    ...c,
    duration_hours: c.duration_hours === null ? null : Number(c.duration_hours),
  })) as CourseRow[];
}
