import { Badge, type BadgeTone } from "@/hrms/components/ui/badge";

const LEAVE: Record<string, { tone: BadgeTone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  APPROVED: { tone: "success", label: "Approved" },
  REJECTED: { tone: "danger", label: "Rejected" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

const ATTENDANCE: Record<string, { tone: BadgeTone; label: string }> = {
  PRESENT: { tone: "success", label: "Present" },
  HALF_DAY: { tone: "info", label: "Half day" },
  ABSENT: { tone: "danger", label: "Absent" },
  ON_LEAVE: { tone: "warning", label: "On leave" },
  HOLIDAY: { tone: "brand", label: "Holiday" },
  WEEKLY_OFF: { tone: "neutral", label: "Weekly off" },
};

const TRAINING: Record<string, { tone: BadgeTone; label: string }> = {
  ASSIGNED: { tone: "neutral", label: "Assigned" },
  IN_PROGRESS: { tone: "info", label: "In progress" },
  COMPLETED: { tone: "success", label: "Completed" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
};

const PAYROLL: Record<string, { tone: BadgeTone; label: string }> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  PROCESSING: { tone: "info", label: "Processing" },
  PENDING_APPROVAL: { tone: "warning", label: "Pending approval" },
  APPROVED: { tone: "brand", label: "Approved" },
  PAID: { tone: "success", label: "Paid" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
};

const MAPS = { leave: LEAVE, attendance: ATTENDANCE, training: TRAINING, payroll: PAYROLL };

export function StatusBadge({ kind, status }: { kind: keyof typeof MAPS; status: string }) {
  const entry = MAPS[kind][status] ?? { tone: "neutral" as BadgeTone, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
