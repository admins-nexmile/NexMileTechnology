"use client";

import { useActionState } from "react";
import {
  revokeInvitationAction,
  type ActionState,
} from "@/app/hrms/(app)/admin/invitations/actions";
import { SubmitButton } from "@/hrms/components/auth/submit-button";

export function RevokeInvitationButton({ id, email }: { id: string; email: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    revokeInvitationAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Revoke the invitation for ${email}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" pendingLabel="Revoking…" aria-label={`Revoke invitation for ${email}`}>
        Revoke
      </SubmitButton>
      {state && !state.ok ? (
        <p role="alert" className="mt-1 text-xs text-danger-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
