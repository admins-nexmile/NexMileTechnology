import { cn } from "@/hrms/lib/utils/cn";

/** Shared sidebar item styles (usable from server and client components). */
export const navItemBase =
  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

export function navLinkClasses(active: boolean): string {
  return cn(
    navItemBase,
    active
      ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--color-brand-300)]"
      : "text-slate-300 hover:bg-white/5 hover:text-white",
  );
}
