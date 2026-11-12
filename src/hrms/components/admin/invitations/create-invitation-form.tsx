"use client";

import { useActionState, useId, useState } from "react";
import {
  createInvitationAction,
  type ActionState,
} from "@/app/hrms/(app)/admin/invitations/actions";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import { Icon } from "@/hrms/components/ui/icons";
import { cn } from "@/hrms/lib/utils/cn";

export type EmployeeOption = {
  id: string;
  label: string;
  workEmail: string;
};

export type RoleOption = { key: string; label: string };

const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50";

export function CreateInvitationForm({
  employees,
  roles,
  appUrl,
}: {
  employees: EmployeeOption[];
  roles: RoleOption[];
  appUrl: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createInvitationAction,
    null,
  );
  const [email, setEmail] = useState("");
  const ids = { employee: useId(), email: useId(), role: useId(), status: useId() };

  const disabled = employees.length === 0 || roles.length === 0;

  return (
    <form action={formAction} className="space-y-4" aria-describedby={ids.status}>
      <div>
        <label htmlFor={ids.employee} className="text-sm font-medium text-ink">
          Employee
        </label>
        <select
          id={ids.employee}
          name="employeeId"
          required
          disabled={disabled}
          defaultValue=""
          className={fieldClass}
          onChange={(e) => {
            const picked = employees.find((emp) => emp.id === e.target.value);
            setEmail(picked?.workEmail ?? "");
          }}
        >
          <option value="" disabled>
            {employees.length === 0 ? "No employees available to invite" : "Select an employee…"}
          </option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={ids.email} className="text-sm font-medium text-ink">
          Google account email
        </label>
        <input
          id={ids.email}
          name="email"
          type="email"
          required
          disabled={disabled}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@gmail.com"
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-ink-subtle">
          Filled from the employee&apos;s work email. It must match exactly.
        </p>
      </div>

      <div>
        <label htmlFor={ids.role} className="text-sm font-medium text-ink">
          Role
        </label>
        <select
          id={ids.role}
          name="role"
          required
          disabled={disabled}
          defaultValue={roles.length === 1 ? roles[0]!.key : ""}
          className={fieldClass}
        >
          {roles.length !== 1 ? (
            <option value="" disabled>
              Select a role…
            </option>
          ) : null}
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton variant="primary" disabled={disabled} pendingLabel="Creating…">
        <Icon name="userPlus" className="size-4" />
        Create invitation
      </SubmitButton>

      <div id={ids.status} aria-live="polite">
        {state ? (
          <div
            role={state.ok ? "status" : "alert"}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm",
              state.ok
                ? "border-success-100 bg-success-50 text-success-700"
                : "border-danger-100 bg-danger-50 text-danger-700",
            )}
          >
            <p>{state.message}</p>
            {state.ok ? (
              <p className="mt-1">
                Ask the employee to sign in at{" "}
                <span className="font-medium">{appUrl}</span> with the Google
                account HR invited.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
