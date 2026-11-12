import type { FieldOption } from "@/hrms/components/ui/admin-form";

export const EMPLOYMENT_TYPES: FieldOption[] = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

export const EMPLOYMENT_STATUSES: FieldOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "NOTICE_PERIOD", label: "Notice period" },
  { value: "INACTIVE", label: "Inactive" },
];

export const AUDIENCES: FieldOption[] = [
  { value: "ALL", label: "Everyone" },
  { value: "DEPARTMENT", label: "One department" },
  { value: "MANAGERS", label: "Managers" },
];

export function labelFor(options: FieldOption[], value: string | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? value ?? "—";
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in IST for datetime-local inputs. */
export function toIstLocalInput(timestamp: string | null): string {
  if (!timestamp) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
