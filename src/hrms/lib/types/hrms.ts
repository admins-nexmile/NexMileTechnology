import type { IconName } from "@/hrms/components/ui/icons";

/** ISO calendar date, YYYY-MM-DD. */
export type IsoDate = string;

/** What the navigation needs to know about the signed-in user. */
export type NavContext = {
  permissions: readonly string[];
  roleKeys: readonly string[];
  /** Account is linked to an employee record (self-service available). */
  hasEmployee: boolean;
};

export type NavItem = {
  label: string;
  icon: IconName;
  href: string;
  /** Rendered only when this returns true for the signed-in user. */
  show: (context: NavContext) => boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export type StatTone = "brand" | "success" | "warning" | "info";

export type StatSummary = {
  id: string;
  label: string;
  value: string;
  icon: IconName;
  tone: StatTone;
  /** Short supporting line, e.g. "of 12 active employees". */
  detail: string;
};

/** Signed-in user as shown in the top bar (name, email, role label). */
export type HeaderUser = {
  name: string;
  role: string;
  email: string;
};
