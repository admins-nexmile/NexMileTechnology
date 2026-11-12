import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { asRows, throwIfError } from "./errors";

/** Audit-log reads (migration 2.12). The functions require the super_admin role. */

export type AuditEntry = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  actor_email: string | null;
  actor_employee_code: string | null;
  actor_employee_name: string | null;
  total_count: number;
};

export async function listAudit(limit: number, offset: number, action: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_list", {
    p_limit: limit,
    p_offset: offset,
    p_action: action,
  });
  throwIfError(error);
  const rows = asRows<AuditEntry>(data);
  return { rows, total: rows.length > 0 ? Number(rows[0]!.total_count) : 0 };
}

export async function listAuditActions(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_actions");
  throwIfError(error);
  return asRows<{ action: string }>(data).map((r) => r.action);
}
