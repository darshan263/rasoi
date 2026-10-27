"use client";

import { useEffect } from "react";

import { IconX } from "./Icons";

/** A dialog: a sheet from the bottom on a phone, a centred card on a wider screen. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
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
    </div>
  );
}
