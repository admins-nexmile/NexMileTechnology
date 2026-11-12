import { Icon } from "@/hrms/components/ui/icons";
import type { StatSummary, StatTone } from "@/hrms/lib/types/hrms";
import { cn } from "@/hrms/lib/utils/cn";

const toneClasses: Record<StatTone, string> = {
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  info: "bg-info-50 text-info-700",
};

export function StatCard({ stat }: { stat: StatSummary }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{stat.label}</p>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            toneClasses[stat.tone],
          )}
        >
          <Icon name={stat.icon} className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{stat.value}</p>
      <p className="mt-auto pt-3 text-sm text-ink-subtle">{stat.detail}</p>
    </div>
  );
}
