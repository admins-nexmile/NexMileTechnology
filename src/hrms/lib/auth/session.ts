import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/hrms/lib/supabase/server";
import { checkEmailPolicy, type EmailPolicyResult } from "./email-policy";

export type SessionRole = { key: string; name: string };

/** A signed-in, active user with at least one role. */
export type ActiveUser = {
  userId: string;
  email: string;
  /** Display name: profile full name, or the email's local part. */
  name: string;
  employeeId: string | null;
  roles: SessionRole[];
  permissions: string[];
};

export type AccessState =
  | { status: "anonymous" }
  | { status: "rejected"; reason: Extract<EmailPolicyResult, { ok: false }>["reason"] }
  /** Allowed account, but profile not active or no role assigned yet. */
  | { status: "pending"; userId: string; email: string }
  | ({ status: "active" } & ActiveUser);

/** Display order when a user holds several roles (most privileged first). */
const ROLE_ORDER = ["super_admin", "payroll_admin", "hr_admin", "manager", "employee"];

function roleRank(key: string): number {
  const i = ROLE_ORDER.indexOf(key);
  return i === -1 ? ROLE_ORDER.length : i;
}

type ProfileRow = {
  full_name: string | null;
  status: string;
  employee_id: string | null;
};

type UserRoleRow = {
  role_key: string;
  roles: { name: string } | { name: string }[] | null;
};

/**
 * Data Access Layer entry point for the current user.
 *
 * - Identity comes from `auth.getUser()`, which validates the session with
 *   Supabase Auth rather than trusting cookie contents.
 * - Profile, roles and permissions are read with the user's own session,
 *   so RLS decides what is visible. Any read failure denies access.
 * - Wrapped in React `cache()` so the gate, header and page share one
 *   lookup per request.
 *
 * Must be called inside a <Suspense> boundary (reads cookies).
 */
export const getAccessState = cache(async (): Promise<AccessState> => {
  // Session checks are always per request. supabase-js reads the current
  // time (token expiry), which Cache Components forbids during
  // prerendering, so explicitly defer to request time first.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { status: "anonymous" };

  const policy = checkEmailPolicy(user);
  if (!policy.ok) return { status: "rejected", reason: policy.reason };

  const pending = { status: "pending", userId: user.id, email: policy.email } as const;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, status, employee_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile || profile.status !== "active") return pending;

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role_key, roles(name)")
    .eq("user_id", user.id)
    .returns<UserRoleRow[]>();

  if (rolesError || !roleRows || roleRows.length === 0) return pending;

  const roles: SessionRole[] = roleRows
    .map((row) => {
      const joined = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return { key: row.role_key, name: joined?.name ?? row.role_key };
    })
    .sort((a, b) => roleRank(a.key) - roleRank(b.key));

  const { data: permissionRows, error: permissionsError } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .in(
      "role_key",
      roles.map((r) => r.key),
    )
    .returns<{ permission_key: string }[]>();

  if (permissionsError || !permissionRows) return pending;

  const permissions = [...new Set(permissionRows.map((r) => r.permission_key))].sort();
  const name = profile.full_name?.trim() || policy.email.split("@")[0]!;

  return {
    status: "active",
    userId: user.id,
    email: policy.email,
    name,
    employeeId: profile.employee_id,
    roles,
    permissions,
  };
});

/** Label for the header: role names, most privileged first. */
export function roleLabel(user: Pick<ActiveUser, "roles">): string {
  return user.roles.map((r) => r.name).join(", ");
}
