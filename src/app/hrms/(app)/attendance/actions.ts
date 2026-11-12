"use server";

import { refresh } from "next/cache";
import { getEmployeeUser } from "@/hrms/lib/auth/guards";
import { NOT_ALLOWED, type ActionState } from "@/hrms/lib/actions/types";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/** Checks the caller in for today (IST). The database decides whose row. */
export async function checkInAction(): Promise<ActionState> {
  if (!(await getEmployeeUser())) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in");
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Checked in." };
}

export async function checkOutAction(): Promise<ActionState> {
  if (!(await getEmployeeUser())) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_out");
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Checked out." };
}
