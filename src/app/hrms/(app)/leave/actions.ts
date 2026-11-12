"use server";

import { refresh } from "next/cache";
import { canApproveLeave, getEmployeeUser } from "@/hrms/lib/auth/guards";
import { getAccessState } from "@/hrms/lib/auth/session";
import {
  NOT_ALLOWED,
  formString,
  isIsoDate,
  isUuid,
  type ActionState,
} from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/** Files a leave request for the caller. total_days is computed in the database. */
export async function applyLeaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getEmployeeUser())) return NOT_ALLOWED;

  const leaveTypeId = formString(formData, "leaveTypeId");
  const start = formString(formData, "startDate");
  const end = formString(formData, "endDate");
  const reason = formString(formData, "reason");

  if (!isUuid(leaveTypeId)) return { ok: false, message: "Select a leave type." };
  if (!isIsoDate(start) || !isIsoDate(end)) return { ok: false, message: "Enter valid start and end dates." };
  if (end < start) return { ok: false, message: "The end date cannot be before the start date." };
  if (reason.length > 500) return { ok: false, message: "The reason can be at most 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_leave", {
    p_leave_type_id: leaveTypeId,
    p_start: start,
    p_end: end,
    p_reason: reason || null,
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Leave request submitted." };
}

export async function cancelLeaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getEmployeeUser())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid leave request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_leave", { p_id: id });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Leave request cancelled." };
}

/** Approves or rejects. Team / own-request rules are enforced by decide_leave. */
export async function decideLeaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getAccessState();
  if (access.status !== "active" || !canApproveLeave(access)) return NOT_ALLOWED;

  const id = formString(formData, "id");
  const decision = formString(formData, "decision");
  const note = formString(formData, "note");
  if (!isUuid(id)) return { ok: false, message: "Invalid leave request." };
  if (decision !== "approve" && decision !== "reject") return { ok: false, message: "Choose approve or reject." };
  if (note.length > 500) return { ok: false, message: "The note can be at most 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave", {
    p_id: id,
    p_approve: decision === "approve",
    p_note: note || null,
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: decision === "approve" ? "Leave approved." : "Leave rejected." };
}
