"use client";

import { useActionState, useId } from "react";
import { applyLeaveAction } from "@/app/hrms/(app)/leave/actions";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import { FormStatus, fieldClass, labelClass, textareaClass } from "@/hrms/components/ui/form";
import type { ActionState } from "@/hrms/lib/actions/types";

export type LeaveTypeChoice = { id: string; label: string };

export function ApplyLeaveForm({ types, minDate }: { types: LeaveTypeChoice[]; minDate: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(applyLeaveAction, null);
  const ids = { type: useId(), start: useId(), end: useId(), reason: useId(), status: useId() };

  return (
    <form action={formAction} className="space-y-4" aria-describedby={ids.status}>
      <div>
        <label htmlFor={ids.type} className={labelClass}>
          Leave type
        </label>
        <select id={ids.type} name="leaveTypeId" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Select a leave type…
          </option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.start} className={labelClass}>
            From
          </label>
          <input id={ids.start} name="startDate" type="date" required min={minDate} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={ids.end} className={labelClass}>
            To
          </label>
          <input id={ids.end} name="endDate" type="date" required min={minDate} className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor={ids.reason} className={labelClass}>
          Reason <span className="font-normal text-ink-subtle">(optional)</span>
        </label>
        <textarea id={ids.reason} name="reason" rows={3} maxLength={500} className={textareaClass} />
      </div>
      <p className="text-xs text-ink-subtle">
        Working days are calculated automatically: weekends and company holidays are not counted.
        A request must start and end in the same calendar year.
      </p>
      <SubmitButton variant="primary" pendingLabel="Submitting…">
        Submit request
      </SubmitButton>
      <FormStatus state={state} id={ids.status} />
    </form>
  );
}
