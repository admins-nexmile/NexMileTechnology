import type { ReactNode } from "react";
import { BrandLogo } from "@/hrms/components/layout/brand-logo";

/** Centered card layout shared by the sign-in and access-pending screens. */
export function AuthCard({
  title,
  titleId,
  children,
}: {
  title: string;
  titleId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-12">
      <BrandLogo variant="dark" />
      <main
        aria-labelledby={titleId}
        className="mt-8 w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8"
      >
        <h1 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

export function AuthCardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mt-6 space-y-3">
      <span className="sr-only">Loading…</span>
      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}
