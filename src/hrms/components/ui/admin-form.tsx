"use client";

import { useActionState, useId } from "react";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import { FormStatus, fieldClass, labelClass, textareaClass } from "@/hrms/components/ui/form";
import type { ActionState } from "@/hrms/lib/actions/types";
import { cn } from "@/hrms/lib/utils/cn";

export type FieldOption = { value: string; label: string };

export type FormField = {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "datetime-local"
    | "number"
    | "textarea"
    | "select"
    | "checkbox";
  required?: boolean;
  defaultValue?: string | boolean | null;
  options?: FieldOption[];
  /** For selects: label of an empty first option (value ""). */
  emptyOption?: string;
  hint?: string;
  maxLength?: number;
  step?: string;
  min?: string;
  max?: string;
  /** Span both columns in the two-column layout. */
  wide?: boolean;
};

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Data-driven form for admin screens. Field definitions are plain data,
 * so server pages can describe a form without writing client code; the
 * Server Action re-validates everything and the database validates again.
 */
export function AdminForm({
  action,
  fields,
  hidden = {},
  submitLabel,
  pendingLabel = "Savingâ€¦",
  columns = 1,
}: {
  action: ServerAction;
  fields: FormField[];
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingLabel?: string;
  columns?: 1 | 2;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const baseId = useId();
  const statusId = `${baseId}-status`;

  return (
    <form action={formAction} className="space-y-4" aria-describedby={statusId}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={cn("grid grid-cols-1 gap-4", columns === 2 && "sm:grid-cols-2")}>
        {fields.map((f) => {
          const id = `${baseId}-${f.name}`;
          const hintId = f.hint ? `${id}-hint` : undefined;
          const wide = f.wide || f.type === "textarea";
          if (f.type === "checkbox") {
            return (
              <div key={f.name} className={cn("flex items-start gap-2", wide && "sm:col-span-2")}>
                <input
                  id={id}
                  name={f.name}
                  type="checkbox"
                  defaultChecked={Boolean(f.defaultValue)}
                  aria-describedby={hintId}
                  className="mt-1 size-4 rounded border-line text-brand-700 focus:ring-brand-200"
                />
                <label htmlFor={id} className="text-sm text-ink">
                  {f.label}
                  {f.hint ? (
                    <span id={hintId} className="block text-xs text-ink-subtle">
                      {f.hint}
                    </span>
                  ) : null}
                </label>
              </div>
            );
          }
          const value = typeof f.defaultValue === "string" ? f.defaultValue : "";
          return (
            <div key={f.name} className={cn(wide && columns === 2 && "sm:col-span-2")}>
              <label htmlFor={id} className={labelClass}>
                {f.label}
                {!f.required ? <span className="font-normal text-ink-subtle"> (optional)</span> : null}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={id}
                  name={f.name}
                  rows={4}
                  required={f.required}
                  defaultValue={value}
                  maxLength={f.maxLength}
                  aria-describedby={hintId}
                  className={textareaClass}
                />
              ) : f.type === "select" ? (
                <select
                  id={id}
                  name={f.name}
                  required={f.required}
                  defaultValue={value}
                  aria-describedby={hintId}
                  className={fieldClass}
                >
                  {f.emptyOption !== undefined ? <option value="">{f.emptyOption}</option> : null}
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type}
                  required={f.required}
                  defaultValue={value}
                  maxLength={f.maxLength}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  aria-describedby={hintId}
                  className={fieldClass}
                />
              )}
              {f.hint ? (
                <p id={hintId} className="mt-1 text-xs text-ink-subtle">
                  {f.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <SubmitButton variant="primary" pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
      <FormStatus state={state} id={statusId} />
    </form>
  );
}
