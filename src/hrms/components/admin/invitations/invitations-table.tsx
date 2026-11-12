import { Badge, type BadgeTone } from "@/hrms/components/ui/badge";
import type { InvitationRow, InvitationStatus } from "@/hrms/lib/invitations/data";
import { formatDateTime } from "@/hrms/lib/utils/format";
import { RevokeInvitationButton } from "./revoke-invitation-button";

const STATUS_TONE: Record<InvitationStatus, BadgeTone> = {
  pending: "warning",
  accepted: "success",
  revoked: "neutral",
  expired: "danger",
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

export function InvitationsTable({
  invitations,
  revocableRoles,
}: {
  invitations: InvitationRow[];
  /** Roles whose pending invitations the viewer may revoke. */
  revocableRoles: readonly string[];
}) {
  if (invitations.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-ink-subtle">No invitations yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Invitations</caption>
        <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-ink-subtle">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Employee</th>
            <th scope="col" className="px-5 py-3 font-medium">Email</th>
            <th scope="col" className="px-5 py-3 font-medium">Role</th>
            <th scope="col" className="px-5 py-3 font-medium">Status</th>
            <th scope="col" className="px-5 py-3 font-medium">Dates</th>
            <th scope="col" className="px-5 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {invitations.map((inv) => (
            <tr key={inv.id} className="align-top">
              <td className="px-5 py-3">
                <p className="font-medium text-ink">{inv.employee_name ?? "—"}</p>
                {inv.employee_code ? (
                  <p className="text-xs text-ink-subtle">{inv.employee_code}</p>
                ) : null}
              </td>
              <td className="px-5 py-3 text-ink-muted">{inv.email}</td>
              <td className="px-5 py-3 text-ink-muted">{inv.role_name}</td>
              <td className="px-5 py-3">
                <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
              </td>
              <td className="px-5 py-3 text-xs text-ink-subtle">
                <p>Created {formatDateTime(inv.created_at)}</p>
                {inv.invited_by_email ? <p>by {inv.invited_by_email}</p> : null}
                {inv.status === "pending" ? <p>Expires {formatDateTime(inv.expires_at)}</p> : null}
                {inv.accepted_at ? <p>Accepted {formatDateTime(inv.accepted_at)}</p> : null}
                {inv.revoked_at ? <p>Revoked {formatDateTime(inv.revoked_at)}</p> : null}
              </td>
              <td className="px-5 py-3 text-right">
                {inv.status === "pending" && revocableRoles.includes(inv.role_key) ? (
                  <RevokeInvitationButton id={inv.id} email={inv.email} />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
