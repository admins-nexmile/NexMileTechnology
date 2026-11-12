import type { StatSummary } from "@/hrms/lib/types/hrms";
import { StatCard } from "./stat-card";

export function StatsGrid({ stats }: { stats: StatSummary[] }) {
  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.id}>
            <StatCard stat={stat} />
          </li>
        ))}
      </ul>
    </section>
  );
}
