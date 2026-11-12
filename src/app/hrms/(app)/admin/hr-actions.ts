"use server";

import { refresh } from "next/cache";
import { getUserWithPermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import {
  NOT_ALLOWED,
  formString,
  isIsoDate,
  isUuid,
  type ActionState,
} from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/**
 * HR administration actions (migration 2.9). Each checks employees.manage
 * here for a clear message; the admin_* database functions re-check it,
 * validate every field and write the audit log.
 */

async function requireHr() {
  return getUserWithPermission(PERMISSIONS.employeesManage);
}

async function call(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: ok };
}

function optionalUuid(formData: FormData, key: string): string | null {
  const v = formString(formData, key);
  return isUuid(v) ? v : null;
}

const checkbox = (formData: FormData, key: string) => formData.get(key) === "on";

/** "YYYY-MM-DDTHH:mm" from a datetime-local input, interpreted as IST. */
function istDateTime(formData: FormData, key: string): string | null {
  const v = formString(formData, key);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+05:30` : null;
}

// ---------------------------------------------------------------- employees

const EMPLOYEE_TEXT_FIELDS = [
  "first_name",
  "middle_name",
  "last_name",
  "work_email",
  "phone",
  "designation",
  "employment_type",
  "hire_date",
  "work_location",
] as const;

function employeeDetails(formData: FormData): Record<string, string | null> {
  const data: Record<string, string | null> = {
    employee_code: formString(formData, "employee_code").toUpperCase(),
  };
  for (const key of EMPLOYEE_TEXT_FIELDS) data[key] = formString(formData, key) || null;
  return data;
}

export async function createEmployeeAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const data: Record<string, string | null> = {
    ...employeeDetails(formData),
    employment_status: formString(formData, "employment_status") || "ACTIVE",
    department_id: optionalUuid(formData, "department_id"),
    manager_id: optionalUuid(formData, "manager_id"),
  };
  if (!data.hire_date || !isIsoDate(data.hire_date)) return { ok: false, message: "Enter a valid hire date." };
  return call("admin_create_employee", { p_data: data }, `Employee ${data.employee_code} created.`);
}

export async function updateEmployeeAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid employee." };
  const data = employeeDetails(formData);
  if (!data.hire_date || !isIsoDate(data.hire_date)) return { ok: false, message: "Enter a valid hire date." };
  return call("admin_update_employee", { p_id: id, p_data: data }, "Employee details saved.");
}

export async function setOrganisationAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid employee." };
  const supabase = await createClient();

  // Only changed values are sent (each change is a separate audited call).
  const changed = (key: string) => formString(formData, key) !== formString(formData, `orig_${key}`);
  const steps: [string, Record<string, unknown>][] = [];
  if (changed("department_id")) {
    steps.push(["admin_set_department", { p_employee_id: id, p_department_id: optionalUuid(formData, "department_id") }]);
  }
  if (changed("manager_id")) {
    steps.push(["admin_set_manager", { p_employee_id: id, p_manager_id: optionalUuid(formData, "manager_id") }]);
  }
  if (changed("employment_status")) {
    steps.push(["admin_set_employment_status", { p_employee_id: id, p_status: formString(formData, "employment_status") }]);
  }
  if (steps.length === 0) return { ok: true, message: "Nothing changed." };
  for (const [fn, args] of steps) {
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      refresh();
      return { ok: false, message: toUserMessage(error) };
    }
  }
  refresh();
  return { ok: true, message: "Changes saved." };
}

// ---------------------------------------------------------------- reference data

export async function saveDepartmentAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  return call(
    "admin_save_department",
    {
      p_id: optionalUuid(formData, "id"),
      p_name: formString(formData, "name"),
      p_description: formString(formData, "description") || null,
    },
    "Department saved.",
  );
}

export async function saveLeaveTypeAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const allowance = Number(formString(formData, "annual_allowance") || "0");
  if (!Number.isFinite(allowance)) return { ok: false, message: "Annual allowance must be a number." };
  return call(
    "admin_save_leave_type",
    {
      p_id: optionalUuid(formData, "id"),
      p_data: {
        name: formString(formData, "name"),
        code: formString(formData, "code").toUpperCase(),
        annual_allowance: allowance,
        is_paid: checkbox(formData, "is_paid"),
        requires_approval: checkbox(formData, "requires_approval"),
        is_active: checkbox(formData, "is_active"),
      },
    },
    "Leave type saved.",
  );
}

export async function saveHolidayAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const date = formString(formData, "holiday_date");
  if (!isIsoDate(date)) return { ok: false, message: "Enter a valid date." };
  return call(
    "admin_save_holiday",
    {
      p_id: optionalUuid(formData, "id"),
      p_name: formString(formData, "name"),
      p_date: date,
      p_location: formString(formData, "location") || null,
      p_description: formString(formData, "description") || null,
    },
    "Holiday saved.",
  );
}

export async function deleteHolidayAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid holiday." };
  return call("admin_delete_holiday", { p_id: id }, "Holiday deleted.");
}

export async function saveAnnouncementAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const audience = formString(formData, "audience") || "ALL";
  return call(
    "admin_save_announcement",
    {
      p_id: optionalUuid(formData, "id"),
      p_data: {
        title: formString(formData, "title"),
        body: formString(formData, "body"),
        audience,
        department_id: audience === "DEPARTMENT" ? optionalUuid(formData, "department_id") : null,
        is_published: checkbox(formData, "is_published"),
        published_at: istDateTime(formData, "published_at"),
        expires_at: istDateTime(formData, "expires_at"),
      },
    },
    "Announcement saved.",
  );
}

export async function saveCourseAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  return call(
    "admin_save_course",
    {
      p_id: optionalUuid(formData, "id"),
      p_data: {
        title: formString(formData, "title"),
        description: formString(formData, "description") || null,
        category: formString(formData, "category") || null,
        duration_hours: formString(formData, "duration_hours") || "0",
        is_mandatory: checkbox(formData, "is_mandatory"),
        is_active: checkbox(formData, "is_active"),
      },
    },
    "Course saved.",
  );
}

export async function enrollAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const course = formString(formData, "course_id");
  const employee = formString(formData, "employee_id");
  if (!isUuid(course) || !isUuid(employee)) return { ok: false, message: "Choose a course and an employee." };
  return call("admin_enroll", { p_course_id: course, p_employee_id: employee }, "Employee enrolled.");
}

export async function cancelEnrollmentAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireHr())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid enrolment." };
  return call("admin_cancel_enrollment", { p_id: id }, "Enrolment cancelled.");
}
