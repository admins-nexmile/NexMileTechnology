"use server";

import { refresh } from "next/cache";
import { getEmployeeUser } from "@/hrms/lib/auth/guards";
import { NOT_ALLOWED, formString, type ActionState } from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

const PHONE_RE = /^\+?[0-9][0-9 -]{6,18}[0-9]$/;

/** Updates the caller's own phone number (the only self-editable field). */
export async function updatePhoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getEmployeeUser())) return NOT_ALLOWED;
  const phone = formString(formData, "phone");
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, message: "Enter a valid phone number (digits, spaces or dashes, optional leading +)." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_phone", { p_phone: phone || null });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: phone ? "Phone number saved." : "Phone number removed." };
}
