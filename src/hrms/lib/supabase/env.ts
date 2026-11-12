/**
 * Public Supabase configuration.
 *
 * Only the project URL and the *publishable* key belong here. Both are
 * safe to ship to the browser; data protection comes from RLS, not from
 * hiding these values. A service-role or secret key must never be read
 * anywhere in this application.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can
 * inline the values into client bundles.
 */
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }

  // Guard against a privileged key being pasted into a public variable.
  if (publishableKey.startsWith("sb_secret_") || looksLikeServiceRoleJwt(publishableKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a privileged key. Use the publishable key only.",
    );
  }

  return { url, publishableKey };
}

/** Detects a legacy service_role JWT without verifying it. */
function looksLikeServiceRoleJwt(key: string): boolean {
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return /"role"\s*:\s*"service_role"/.test(json);
  } catch {
    return false;
  }
}
