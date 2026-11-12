import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/hrms/auth/actions";
import { AuthCard, AuthCardSkeleton } from "@/hrms/components/auth/auth-card";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import { Icon } from "@/hrms/components/ui/icons";
import { LOGIN_ERRORS, isLoginErrorCode } from "@/hrms/lib/auth/errors";
import { getAccessState } from "@/hrms/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage({ searchParams }: PageProps<"/hrms/login">) {
  return (
    <AuthCard title="Sign in to Nexmile HRMS" titleId="login-title">
      <p className="mt-2 text-sm text-ink-subtle">
        Sign in with the Google account HR invited.
      </p>
      <Suspense fallback={<AuthCardSkeleton />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: PageProps<"/hrms/login">["searchParams"];
}) {
  const access = await getAccessState();
  if (access.status === "active") redirect("/hrms");
  if (access.status === "pending") redirect("/hrms/access-pending");

  const params = await searchParams;
  const errorCode = isLoginErrorCode(params.error) ? params.error : null;
  const signedOut = params.signed_out === "1";

  return (
    <>
      {errorCode ? (
        <p
          role="alert"
          className="mt-5 flex gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
        >
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {LOGIN_ERRORS[errorCode]}
        </p>
      ) : signedOut ? (
        <p
          role="status"
          className="mt-5 rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-sm text-ink-muted"
        >
          You have been signed out.
        </p>
      ) : null}

      <form action={signInWithGoogle} className="mt-6">
        <SubmitButton
          variant="primary"
          className="w-full"
          pendingLabel="Redirecting to Google…"
        >
          <GoogleMark />
          Sign in with Google
        </SubmitButton>
      </form>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
        <Icon name="lock" className="mt-0.5 size-3.5 shrink-0" />
        Access is by invitation only. Contact HR if you need an account.
      </p>
    </>
  );
}

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-800"
    >
      G
    </span>
  );
}
