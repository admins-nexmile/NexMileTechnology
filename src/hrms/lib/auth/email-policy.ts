import type { User } from "@supabase/supabase-js";

/**
 * Basic email shape: lowercase-insensitive, exactly one "@", no
 * whitespace. Mirrors invitations_email_format_check (migration 2.7).
 */
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

export function isValidEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

export type EmailPolicyResult =
  | { ok: true; email: string }
  | { ok: false; reason: "unverified" };

/**
 * Server-side sign-in policy: any Google account may authenticate, but
 * its email must be verified. Access itself is decided by invitations
 * (see /auth/callback and the dashboard gate), not by email domain.
 *
 * `user` must come from a verified source (`auth.getUser()` or the code
 * exchange), never from client input or user-editable metadata.
 */
export function checkEmailPolicy(
  user: Pick<User, "email" | "email_confirmed_at">,
): EmailPolicyResult {
  if (!isValidEmail(user.email) || !user.email_confirmed_at) {
    return { ok: false, reason: "unverified" };
  }
  return { ok: true, email: user.email!.trim().toLowerCase() };
}
