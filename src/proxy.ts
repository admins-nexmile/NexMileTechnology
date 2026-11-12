import type { NextRequest } from "next/server";
import { updateSession } from "@/hrms/lib/supabase/proxy";

/**
 * Supabase session refresh and optimistic route protection for the HRMS
 * only. Marketing pages are not matched, so they stay static and never
 * touch auth cookies.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/hrms", "/hrms/:path*"],
};