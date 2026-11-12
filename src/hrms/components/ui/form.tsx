"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import type { ButtonProps } from "@/hrms/components/ui/button";
import type { ActionState } from "@/hrms/lib/actions/types";
import { cn } from "@/hrms/lib/utils/cn";

export const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50";

export const textareaClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export const labelClass = "text-sm font-medium text-ink";

/** Success / error message for a Server Action result. */
export function FormStatus({ state, id }: { state: ActionState; id?: string }) {
  return (
    <div id={id} aria-live="polite">
      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            state.ok
              ? "border-success-100 bg-success-50 text-success-700"
              : "border-danger-100 bg-danger-50 text-danger-700",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A one-button form that calls a Server Action with hidden fields, e.g.
 * "Cancel request" or "Check in". Optional browser confirmation.
 */
export function ActionButton({
  action,
  fields = {},
  confirmMessage,
  children,
  pendingLabel,
  variant = "secondary",
  size = "sm",
  ariaLabel,
  showSuccess = false,
}: {
  action: ServerAction;
  fields?: Record<string, string>;
  confirmMessage?: string;
  children: ReactNode;
  pendingLabel: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  ariaLabel?: string;
  showSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
      className="inline-block"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel} aria-label={ariaLabel}>
        {children}
      </SubmitButton>
      {state && (!state.ok || showSuccess) ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn("mt-1 text-xs", state.ok ? "text-success-700" : "text-danger-700")}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
