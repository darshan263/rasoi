"use client";

import { useState } from "react";

import { assetUrl } from "@/lib/api-client";

/**
 * A square or rounded photo with a fallback. A missing photo, or one that fails to load (the
 * seeded library photos come from another site), shows `fallback` — usually an emoji or the
 * first letter — so a row never shows a broken-image icon.
 */
export function Thumb({
  src,
  alt,
  size,
  fallback,
  radius = 12,
  fit = "cover",
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  fallback: string;
  radius?: number;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = assetUrl(src);
  const show = url && failed !== url;

  return (
    <span
      className={`thumb ${className}`}
      data-fit={fit}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: size ? Math.max(12, size * 0.42) : "2.5rem",
      }}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- plain <img>: works in a static export and from any host
        <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(url)} />
      ) : (
        <span aria-hidden="true" style={{ color: "var(--text-faint)", fontWeight: 600 }}>
          {fallback}
        </span>
      )}
    </span>
  );
}
