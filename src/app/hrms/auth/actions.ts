"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginErrorPath } from "@/hrms/lib/auth/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/**
 * Starts Google OAuth (PKCE). The code verifier is stored in a cookie by
 * the server client, and Google redirects back to /auth/callback.
 */
export async function signInWithGoogle(): Promise<never> {
  // Server Actions are POST-only and Next.js rejects requests whose Origin
  // does not match the host, so this header is safe to build URLs from.
  // Supabase additionally checks redirectTo against its allow-list.
  const origin = (await headers()).get("origin");
  if (!origin) redirect(loginErrorPath("callback"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/hrms/auth/callback`,
      queryParams: {
        // Personal Google accounts are allowed; access is decided by the
        // invitation check in /auth/callback.
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) redirect(loginErrorPath("oauth"));
  redirect(data.url);
}

/** Signs out on the server (clears auth cookies) and returns to /login. */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/hrms/login?signed_out=1");
}
