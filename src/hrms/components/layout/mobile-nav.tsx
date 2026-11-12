"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Icon } from "@/hrms/components/ui/icons";

/**
 * Mobile / tablet navigation drawer built on the native <dialog> element.
 * showModal() provides a focus trap, Esc-to-close, an inert background and
 * focus restoration to the trigger button.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function openDrawer() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeDrawer() {
    dialogRef.current?.close();
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    // Clicking the backdrop targets the <dialog> element itself.
    if (event.target === event.currentTarget) {
      closeDrawer();
      return;
    }
    // Close after following a navigation link.
    if ((event.target as HTMLElement).closest("a[href]")) {
      closeDrawer();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        className="inline-flex size-10 items-center justify-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink lg:hidden"
      >
        <Icon name="menu" className="size-6" />
      </button>

      <dialog
        id="mobile-navigation"
        ref={dialogRef}
        aria-label="Navigation menu"
        onClose={() => setOpen(false)}
        onClick={handleDialogClick}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-transparent p-0 backdrop:bg-slate-900/50 lg:hidden"
      >
        <div className="relative h-full">
          {children}
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation menu"
            className="absolute right-3 top-3.5 inline-flex size-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
      </dialog>
    </>
  );
}
