import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { asRows, throwIfError } from "./errors";
import { fullName } from "./team";

/**
 * Reads for /admin pages. Callers must have checked employees.manage /
 * users.read first; RLS (employees.read_all, employees.manage branches in
 * 2.6) and the admin_* functions enforce it again. No salary data here.
 */

export type AdminEmployee = {
  id: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  name: string;
  work_email: string;
  phone: string | null;
  designation: string;
  employment_type: string;
  employment_status: string;
  hire_date: string;
  work_location: string | null;
  department_id: string | null;
  department: string | null;
  manager_id: string | null;
};

export type Department = { id: string; name: string; description: string | null };

export type AdminLeaveType = {
  id: string;
  name: string;
  code: string;
  annual_allowance: number;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
};

export type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: "ALL" | "DEPARTMENT" | "MANAGERS";
  department_id: string | null;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type AdminCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_hours: number;
  is_mandatory: boolean;
  is_active: boolean;
};

export type AdminEnrollment = {
  id: string;
  course_id: string;
  employee_id: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
};

export type AdminUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  status: "pending" | "active" | "suspended";
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string | null;
  roles: string[];
  created_at: string;
};

const EMPLOYEE_COLUMNS =
  "id, employee_code, first_name, middle_name, last_name, work_email, phone, designation, employment_type, employment_status, hire_date, work_location, department_id, manager_id, department:departments(name)";

type EmployeeRow = Omit<AdminEmployee, "name" | "department"> & {
  department: { name: string } | { name: string }[] | null;
};

function toEmployee(r: EmployeeRow): AdminEmployee {
  const dept = Array.isArray(r.department) ? r.department[0] : r.department;
  return { ...r, name: fullName(r), department: dept?.name ?? null };
}

export async function listEmployees(): Promise<AdminEmployee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .order("employee_code");
  throwIfError(error);
  return ((data ?? []) as unknown as EmployeeRow[]).map(toEmployee);
}

export async function getEmployee(id: string): Promise<AdminEmployee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? toEmployee(data as unknown as EmployeeRow) : null;
}

export async function listDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("id, name, description").order("name");
  throwIfError(error);
  return (data ?? []) as Department[];
}

export async function listAllLeaveTypes(): Promise<AdminLeaveType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_types")
    .select("id, name, code, annual_allowance, is_paid, requires_approval, is_active")
    .order("name");
  throwIfError(error);
  return (data ?? []).map((t) => ({ ...t, annual_allowance: Number(t.annual_allowance) })) as AdminLeaveType[];
}

export async function listAllAnnouncements(): Promise<AdminAnnouncement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, audience, department_id, is_published, published_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  throwIfError(error);
  return (data ?? []) as AdminAnnouncement[];
}

export async function listAllCourses(): Promise<AdminCourse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_courses")
    .select("id, title, description, category, duration_hours, is_mandatory, is_active")
    .order("title");
  throwIfError(error);
  return (data ?? []).map((c) => ({ ...c, duration_hours: Number(c.duration_hours ?? 0) })) as AdminCourse[];
}

export async function listAllEnrollments(): Promise<AdminEnrollment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_enrollments")
    .select("id, course_id, employee_id, status, assigned_at, completed_at")
    .order("assigned_at", { ascending: false })
    .limit(1000);
  throwIfError(error);
  return (data ?? []) as AdminEnrollment[];
}

export async function listUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  throwIfError(error);
  return asRows<AdminUser>(data);
}
