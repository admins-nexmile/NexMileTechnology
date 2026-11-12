"use client";

import { useActionState, useId } from "react";
import { updatePhoneAction } from "@/app/hrms/(app)/profile/actions";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import { FormStatus, fieldClass, labelClass } from "@/hrms/components/ui/form";
import type { ActionState } from "@/hrms/lib/actions/types";

export function PhoneForm({ phone }: { phone: string | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updatePhoneAction, null);
  const ids = { phone: useId(), hint: useId(), status: useId() };
  return (
    <form action={formAction} className="space-y-3" aria-describedby={ids.status}>
      <div>
        <label htmlFor={ids.phone} className={labelClass}>
          Phone number
        </label>
        <input
          id={ids.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={phone ?? ""}
          maxLength={20}
          aria-describedby={ids.hint}
          className={fieldClass}
        />
        <p id={ids.hint} className="mt-1 text-xs text-ink-subtle">
          Digits, spaces or dashes, with an optional leading +. Leave empty to remove it.
        </p>
      </div>
      <SubmitButton variant="primary" pendingLabel="Saving…">
        Save phone number
      </SubmitButton>
      <FormStatus state={state} id={ids.status} />
    </form>
  );
}
