"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { decideLeaveAction } from "@/app/hrms/(app)/leave/actions";
import { Button } from "@/hrms/components/ui/button";
import { FormStatus, fieldClass } from "@/hrms/components/ui/form";
import type { ActionState } from "@/hrms/lib/actions/types";

function DecisionButtons({ employee }: { employee: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-2">
      <Button
        type="submit"
        name="decision"
        value="approve"
        variant="primary"
        size="sm"
        disabled={pending}
        aria-label={`Approve leave for ${employee}`}
      >
        Approve
      </Button>
      <Button
        type="submit"
        name="decision"
        value="reject"
        size="sm"
        disabled={pending}
        aria-label={`Reject leave for ${employee}`}
      >
        Reject
      </Button>
    </div>
  );
}

export function DecideLeaveForm({ id, employee }: { id: string; employee: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(decideLeaveAction, null);
  const noteId = useId();
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={noteId} className="sr-only">
        Decision note for {employee}
      </label>
      <input
        id={noteId}
        name="note"
        maxLength={500}
        placeholder="Note (optional)"
        className={`${fieldClass} mt-0 h-9`}
      />
      <DecisionButtons employee={employee} />
      <FormStatus state={state && !state.ok ? state : null} />
    </form>
  );
}
