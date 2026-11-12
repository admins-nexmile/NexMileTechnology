"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/hrms/components/ui/button";

/** Form submit button that disables itself while its action is pending. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...rest
}: Omit<ButtonProps, "type"> & { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || Boolean(disabled);
  return (
    <Button type="submit" {...rest} disabled={isDisabled} aria-disabled={isDisabled}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
