import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { fieldClass, labelClass } from "@/hrms/components/ui/form";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requireActiveUser } from "@/hrms/lib/auth/guards";
import { ROLES, hasRole } from "@/hrms/lib/auth/permissions";
import { listAudit, listAuditActions } from "@/hrms/lib/data/audit";
import { formatDateTime } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const HIDDEN_DETAIL_KEYS = new Set(["actor_user_id", "at"]);

export default function AuditPage({ searchParams }: PageProps<"/hrms/admin/audit">) {
  return (
    <div className="space-y-6">
      <PageTitle title="Audit log" description="Every administrative and self-service change, newest first. Super Admin only." />
      <Suspense fallback={<PageSkeleton label="Loading audit log…" blocks={1} />}>
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function AuditContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser();
  if (!hasRole(user.roles.map((r) => r.key), ROLES.superAdmin)) notFound();

  const params = await searchParams;
  const actions = await listAuditActions();
  const requested = first(params.action);
  const action = actions.includes(requested) ? requested : null;
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const { rows, total } = await listAudit(PAGE_SIZE, (page - 1) * PAGE_SIZE, action);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (p: number) => {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/hrms/admin/audit?${s}` : "/hrms/admin/audit";
  };

  return (
    <Card>
      <CardHeader
        title="Entries"
        description={`${total} entr${total === 1 ? "y" : "ies"}${action ? ` for ${action}` : ""}`}
        action={
          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="audit-action" className={labelClass}>
                Action
              </label>
              <select id="audit-action" name="action" defaultValue={action ?? ""} className={`${fieldClass} h-9`}>
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-slate-50"
            >
              Filter
            </button>
          </form>
        }
      />
      {rows.length === 0 ? (
        <EmptyState>No audit entries.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit log entries</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">When</th>
                <th scope="col" className="px-5 py-2 font-medium">Action</th>
                <th scope="col" className="px-5 py-2 font-medium">Actor</th>
                <th scope="col" className="px-5 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {rows.map((r) => {
                const details = Object.entries(r.details ?? {}).filter(([k]) => !HIDDEN_DETAIL_KEYS.has(k));
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{formatDateTime(r.created_at)}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone="brand">{r.action}</Badge>
                      <p className="mt-1 text-xs text-ink-subtle">{r.entity_type}</p>
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">
                      {r.actor_employee_name ? (
                        <>
                          {r.actor_employee_name}
                          <span className="text-ink-subtle"> ({r.actor_employee_code})</span>
                        </>
                      ) : (
                        r.actor_email ?? <span className="text-ink-subtle">System / SQL editor</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {details.length === 0 ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                          {details.map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-ink-subtle">{k}</dt>
                              <dd className="break-all font-mono text-ink">
                                {typeof v === "string" ? v : JSON.stringify(v)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav aria-label="Audit log pages" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="font-medium text-brand-700 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-subtle">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className="font-medium text-brand-700 hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </Card>
  );
}
