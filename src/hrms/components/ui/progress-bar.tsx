import { cn } from "@/hrms/lib/utils/cn";

type ProgressBarProps = {
  value: number;
  label: string;
  className?: string;
  barClassName?: string;
};

export function ProgressBar({
  value,
  label,
  className,
  barClassName,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
    >
      <div
        className={cn("h-full rounded-full bg-brand-600", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
