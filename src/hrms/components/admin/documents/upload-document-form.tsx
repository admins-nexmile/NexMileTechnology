"use client";

import { useActionState, useId } from "react";
import { uploadDocumentAction } from "@/app/hrms/(app)/admin/documents/actions";
import { SubmitButton } from "@/hrms/components/auth/submit-button";
import type { FieldOption } from "@/hrms/components/ui/admin-form";
import { FormStatus, fieldClass, labelClass } from "@/hrms/components/ui/form";
import type { ActionState } from "@/hrms/lib/actions/types";

export function UploadDocumentForm({
  employees,
  categories,
}: {
  employees: FieldOption[];
  categories: FieldOption[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(uploadDocumentAction, null);
  const id = useId();
  return (
    <form action={formAction} className="space-y-4" aria-describedby={`${id}-status`}>
      <div>
        <label htmlFor={`${id}-emp`} className={labelClass}>Employee</label>
        <select id={`${id}-emp`} name="employee_id" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select an employee…</option>
          {employees.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-name`} className={labelClass}>Document name</label>
        <input id={`${id}-name`} name="document_name" required maxLength={200} className={fieldClass} />
      </div>
      <div>
        <label htmlFor={`${id}-cat`} className={labelClass}>Category</label>
        <select id={`${id}-cat`} name="document_category" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select a category…</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-file`} className={labelClass}>File</label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg"
          aria-describedby={`${id}-file-hint`}
          className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-50"
        />
        <p id={`${id}-file-hint`} className="mt-1 text-xs text-ink-subtle">PDF, PNG or JPEG, up to 10 MB.</p>
      </div>
      <div className="flex items-start gap-2">
        <input
          id={`${id}-conf`}
          name="is_confidential"
          type="checkbox"
          defaultChecked
          className="mt-1 size-4 rounded border-line text-brand-700 focus:ring-brand-200"
        />
        <label htmlFor={`${id}-conf`} className="text-sm text-ink">
          Confidential
          <span className="block text-xs text-ink-subtle">
            Confidential documents are visible only to HR. Untick to let the employee see it.
          </span>
        </label>
      </div>
      <SubmitButton variant="primary" pendingLabel="Uploading…">Upload document</SubmitButton>
      <FormStatus state={state} id={`${id}-status`} />
    </form>
  );
}
