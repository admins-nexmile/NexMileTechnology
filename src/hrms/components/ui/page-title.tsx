import type { ReactNode } from "react";

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-subtle">{children}</p>;
}

export function PageSkeleton({ label, blocks = 2 }: { label: string; blocks?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}
