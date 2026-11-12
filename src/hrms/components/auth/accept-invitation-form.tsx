"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type AcceptState } from "@/app/hrms/access-pending/actions";
import { SubmitButton } from "./submit-button";

export function AcceptInvitationForm() {
  const [state, formAction] = useActionState<AcceptState, FormData>(
    acceptInvitationAction,
    null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <SubmitButton variant="primary" className="w-full" pendingLabel="Checking invitation…">
        Accept invitation
      </SubmitButton>
      <div aria-live="polite">
        {state ? (
          <p
            role="alert"
            className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
