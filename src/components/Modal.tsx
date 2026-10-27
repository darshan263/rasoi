"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { IconX } from "./Icons";

/** Open dialogs, newest last. Escape closes only the one on top. */
const stack: string[] = [];

/**
 * A dialog: a sheet from the bottom on a phone, a centred card on a wider screen.
 *
 * Rendered into <body> through a portal, because dialogs are often opened from inside a form
 * (the recipe editor) and hold forms of their own. A form inside a form misbehaves: pressing
 * Enter or a submit button can submit the outer one. React also bubbles events through a portal
 * along the component tree, so submit events are stopped at the dialog's edge as well.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  // Callers pass a fresh arrow each render; reading it through a ref keeps the effect below
  // from re-running, which would move this dialog to the top of the stack.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) close.current();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      stack.splice(stack.indexOf(id), 1);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [id]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onSubmit={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0" style={{ background: "rgb(0 0 0 / 0.5)" }} onClick={onClose} />
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl shadow-lg sm:max-w-lg sm:rounded-3xl"
        style={{ background: "var(--bg-elevated)" }}
      >
        <div className="flex items-center gap-3 border-b px-5 py-3.5">
          <h2 className="flex-1 text-lg">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <div className="pb-safe overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
