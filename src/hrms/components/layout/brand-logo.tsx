import { cn } from "@/hrms/lib/utils/cn";

type BrandLogoProps = {
  variant?: "light" | "dark";
  className?: string;
};

/** Text-based Nexmile Technology logo (placeholder until official assets exist). */
export function BrandLogo({ variant = "light", className }: BrandLogoProps) {
  const onDark = variant === "light";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 items-center justify-center rounded-lg text-base font-bold",
          onDark ? "bg-white text-brand-900" : "bg-brand-800 text-white",
        )}
      >
        N
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            onDark ? "text-white" : "text-ink",
          )}
        >
          Nexmile Technology
        </span>
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.14em]",
            onDark ? "text-brand-300" : "text-ink-subtle",
          )}
        >
          HRMS
        </span>
      </span>
    </span>
  );
}
