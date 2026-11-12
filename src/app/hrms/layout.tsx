import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Employee portal (HRMS). Everything under /hrms is private:
 *   - excluded from search engines (robots meta here + robots.txt),
 *   - session refreshed by src/proxy.ts (matcher /hrms only),
 *   - every page and action re-checks access on the server, and the
 *     database enforces RLS and permission checks again.
 * The .hrms class scopes the HRMS design tokens (see globals.css) so the
 * marketing site's theme is unaffected.
 */
export const metadata: Metadata = {
  title: {
    default: "Employee Portal",
    template: "%s | Nexmile HRMS",
  },
  description: "Nexmile Technology employee portal.",
  robots: { index: false, follow: false, nocache: true },
};

export default function HrmsLayout({ children }: { children: ReactNode }) {
  return <div className="hrms flex min-h-dvh flex-1 flex-col bg-canvas text-ink">{children}</div>;
}
