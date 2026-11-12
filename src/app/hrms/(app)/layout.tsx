import { Suspense } from "react";
import { DashboardAccessGate } from "@/hrms/components/auth/dashboard-access-gate";

export default function DashboardLayout({ children }: LayoutProps<"/hrms">) {
  return (
    // The gate reads the session at request time, so it sits behind a
    // Suspense boundary (required with Cache Components). Nothing from the
    // dashboard renders until the server has checked access; the gate then
    // renders the AppShell with the signed-in user.
    <Suspense fallback={null}>
      <DashboardAccessGate>{children}</DashboardAccessGate>
    </Suspense>
  );
}
