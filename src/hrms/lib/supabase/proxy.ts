import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/** Routes reachable without an approved account. */
const PUBLIC_PATHS = ["/hrms/login", "/hrms/auth/callback", "/hrms/access-pending"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie and applies optimistic route
 * protection. This is a convenience layer only: invitation checks happen
 * in /auth/callback, pages re-check access on the server with
 * `auth.getUser()`, and data is protected by RLS.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it
  // refreshes an expired session. getClaims() verifies the JWT signature.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return response;

  if (!claims) {
    const target = NextResponse.redirect(new URL("/hrms/login", request.url));
    for (const cookie of response.cookies.getAll()) {
      target.cookies.set(cookie);
    }
    return target;
  }

  // Signed in: the server-side DashboardAccessGate decides between the
  // dashboard (active profile + role) and /access-pending, using the
  // database rather than anything in the token.
  return response;
}
