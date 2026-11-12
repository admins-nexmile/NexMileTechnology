import { NextResponse, type NextRequest } from "next/server";
import { checkEmailPolicy } from "@/hrms/lib/auth/email-policy";
import { loginErrorPath, type LoginErrorCode } from "@/hrms/lib/auth/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/**
 * OAuth return URL. Exchanges the one-time code for a session, then
 * decides on the server whether the account may stay signed in:
 *
 *   - email not verified            -> sign out, error
 *   - active user with a role       -> dashboard
 *   - pending invitation for email  -> /access-pending (Accept button)
 *   - anything else                 -> sign out, "No invitation found"
 *
 * Uninvited users are never left signed in. Any failure also signs out
 * (fail closed). There is deliberately no `next` parameter, so this
 * route cannot be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const fail = (code: LoginErrorCode) => redirectTo(loginErrorPath(code));

  if (searchParams.has("error")) return fail("oauth");

  const code = searchParams.get("code");
  if (!code) return fail("callback");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("callback");

  const policy = checkEmailPolicy(data.user);
  if (!policy.ok) {
    await supabase.auth.signOut();
    return fail(policy.reason);
  }

  // Server-side, read-only check (migration 2.7). The database reads the
  // verified email and Google identity itself.
  const { data: status, error: statusError } = await supabase.rpc("my_invitation_status");
  if (statusError) {
    await supabase.auth.signOut();
    return fail("callback");
  }

  if (status === "active") return redirectTo("/hrms");
  if (status === "invited") return redirectTo("/hrms/access-pending");

  await supabase.auth.signOut();
  return fail("no_invitation");
}
