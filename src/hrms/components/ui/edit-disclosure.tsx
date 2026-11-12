import type { ReactNode } from "react";

/** Native <details> used for inline "Edit" panels in admin lists. */
export function EditDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-md text-sm font-medium text-brand-700 hover:underline [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Edit</span>
        <span className="hidden group-open:inline">Close</span>
        <span className="sr-only"> {label}</span>
      </summary>
      <div className="mt-3 rounded-lg border border-line bg-slate-50 p-4">{children}</div>
    </details>
  );
}
