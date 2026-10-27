"use client";

import { useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { resizeImage } from "@/lib/resize-image";
import { IconCamera, IconTrash } from "./Icons";
import { Thumb } from "./Thumb";

/**
 * Pick a photo (on a phone this offers the camera or the gallery), shrink it in the browser,
 * upload it, and hand back its URL. Nothing is attached to a recipe or ingredient until that
 * form is saved.
 */
export function ImagePicker({
  value,
  onChange,
  variant,
  fallback,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  variant: "cover" | "square";
  fallback: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeImage(file, variant === "cover" ? 1280 : 480);
      const { url } = await api<{ url: string }>("/api/images", { method: "POST", raw: blob });
      onChange(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const cover = variant === "cover";

  return (
    <div className={cover ? "flex flex-col gap-2" : "flex items-center gap-4"}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative block overflow-hidden text-left"
        style={{
          width: cover ? "100%" : 96,
          aspectRatio: cover ? "16 / 9" : "1 / 1",
          borderRadius: cover ? 16 : 18,
          border: value ? undefined : "2px dashed var(--border-strong)",
        }}
        aria-label={value ? "Change photo" : "Add a photo"}
        disabled={busy}
      >
        {value ? (
          <Thumb
            src={value}
            alt=""
            fallback={fallback}
            radius={0}
            fit={cover ? "cover" : "contain"}
            className="h-full w-full"
          />
        ) : (
          <span
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-sm"
            style={{ color: "var(--text-muted)", background: "var(--bg-sunken)" }}
          >
            <IconCamera size={cover ? 28 : 22} />
            {cover ? "Add a photo of the dish" : "Photo"}
          </span>
        )}
        {busy && (
          <span
            className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
            style={{ background: "rgb(0 0 0 / 0.45)", color: "#fff" }}
          >
            Uploading…
          </span>
        )}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          <IconCamera size={15} />
          {value ? "Change photo" : "Choose photo"}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)} disabled={busy}>
            <IconTrash size={15} />
            Remove
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
          {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
