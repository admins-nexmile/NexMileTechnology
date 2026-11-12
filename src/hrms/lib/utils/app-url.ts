import "server-only";
import { headers } from "next/headers";

/**
 * Employee sign-in URL (…/hrms/login), for display in instructions only
 * (never used for redirects or security decisions). Derived from the
 * request.
 */
export async function getAppUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/hrms/login`;
}
