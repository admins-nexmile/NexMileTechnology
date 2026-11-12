"use server";

import { refresh } from "next/cache";
import { getEmployeeUser } from "@/hrms/lib/auth/guards";
import { NOT_ALLOWED, formString, isUuid, type ActionState } from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

export async function updateTrainingStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await getEmployeeUser())) return NOT_ALLOWED;
  const id = formString(formData, "id");
  const status = formString(formData, "status");
  if (!isUuid(id)) return { ok: false, message: "Invalid enrolment." };
  if (status !== "IN_PROGRESS" && status !== "COMPLETED") return { ok: false, message: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_training_status", {
    p_enrollment_id: id,
    p_status: status,
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: status === "COMPLETED" ? "Marked as completed." : "Marked as in progress." };
}
