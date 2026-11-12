"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/hrms/lib/utils/cn";

type DropdownProps = {
  /** Accessible name for the trigger button. */
  label: string;
  /** Visible trigger content (icon, avatar, etc.). */
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
  triggerClassName?: string;
};

/**
 * Accessible disclosure-style dropdown:
 * - button exposes aria-expanded / aria-controls
 * - Esc closes and returns focus to the trigger
 * - clicking outside or tabbing away closes the panel
 */
export function Dropdown({
  label,
  trigger,
  children,
  align = "right",
  panelClassName,
  triggerClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (open && next && !rootRef.current?.contains(next)) close(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink",
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "absolute top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface shadow-lg",
          align === "right" ? "right-0" : "left-0",
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
