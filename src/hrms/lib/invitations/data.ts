import "server-only";
import { GENERIC_ERROR, asRows, toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/**
 * Server-side access to the invitation RPCs (migration 2.3). Every call
 * runs as the signed-in user; the database checks permissions itself.
 */

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type InvitationRow = {
  id: string;
  email: string;
  role_key: string;
  role_name: string;
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string | null;
  status: InvitationStatus;
  invited_by_email: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type InvitableEmployee = {
  id: string;
  employee_code: string | null;
  full_name: string | null;
  work_email: string;
  status: string;
};

export type AcceptResult = "accepted" | "none" | "expired";

export { toUserMessage };

export async function listInvitations(): Promise<InvitationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_invitations");
  if (error) throw new Error(toUserMessage(error));
  return asRows<InvitationRow>(data);
}

export async function listInvitableEmployees(): Promise<InvitableEmployee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_invitable_employees");
  if (error) throw new Error(toUserMessage(error));
  return asRows<InvitableEmployee>(data);
}

export async function acceptMyInvitation(): Promise<
  { ok: true; result: AcceptResult } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_my_invitation");
  if (error) return { ok: false, message: toUserMessage(error) };
  if (data === "accepted" || data === "none" || data === "expired") {
    return { ok: true, result: data };
  }
  return { ok: false, message: GENERIC_ERROR };
}
