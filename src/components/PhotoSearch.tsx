"use client";

import { useEffect, useState } from "react";

import { api, apiBlob, errorMessage } from "@/lib/api-client";
import { PHOTO_SOURCES, PHOTO_SOURCE_LABELS, type PhotoResult, type PhotoSource } from "@/lib/photo-hosts";
import { resizeImage } from "@/lib/resize-image";
import { IconSearch } from "./Icons";
import { Modal } from "./Modal";

type SourceState = { status: "loading" } | { status: "done"; results: PhotoResult[] } | { status: "off" } | { status: "error" };

/**
 * "Find online": search free photo sources by name, tap one, and it is downloaded, resized
 * and uploaded as the app's own copy, so it never breaks if the original moves.
 *
 * Each source is searched separately and shown as soon as it answers; a slow one (Openverse)
 * does not hold up the rest.
 */
export function PhotoSearch({
  initialQuery,
  kind,
  maxSide,
  onPicked,
  onClose,
}: {
  initialQuery: string;
  kind: "recipe" | "ingredient";
  maxSide: number;
  onPicked: (url: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [sources, setSources] = useState<Partial<Record<PhotoSource, SourceState>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setSources(Object.fromEntries(PHOTO_SOURCES.map((s) => [s, { status: "loading" }])));
    for (const source of PHOTO_SOURCES) {
      const params = new URLSearchParams({ source, kind, q: query });
      api<{ enabled: boolean; results: PhotoResult[] }>(`/api/photo-search?${params}`)
        .then((data) => {
          if (cancelled) return;
          setSources((prev) => ({ ...prev, [source]: data.enabled ? { status: "done", results: data.results } : { status: "off" } }));
        })
        .catch(() => !cancelled && setSources((prev) => ({ ...prev, [source]: { status: "error" } })));
    }
    return () => {
      cancelled = true;
    };
  }, [query, kind]);

  async function pick(photo: PhotoResult) {
    setSaving(photo.full);
    setError(null);
    try {
      const original = await apiBlob(`/api/photo-search/image?url=${encodeURIComponent(photo.full)}`);
      const blob = await resizeImage(original, maxSide);
      const { url } = await api<{ url: string }>("/api/images", { method: "POST", raw: blob });
      onPicked(url);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(null);
    }
  }

  const all = PHOTO_SOURCES.flatMap((s) => {
    const state = sources[s];
    return state?.status === "done" ? state.results : [];
  }).filter((photo) => !broken.has(photo.thumb));
  const loading = PHOTO_SOURCES.filter((s) => sources[s]?.status === "loading");
  const failed = PHOTO_SOURCES.filter((s) => sources[s]?.status === "error");

  return (
    <Modal title="Find a photo online" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input.trim());
          }}
        >
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
              <IconSearch size={17} />
            </span>
            <input
              className="input"
              style={{ paddingLeft: "2.3rem" }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={kind === "recipe" ? "e.g. margherita pizza" : "e.g. tomato"}
              autoFocus={!initialQuery}
              aria-label="Search for a photo"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
            Search
          </button>
        </form>

        {!query && (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Type what the photo should show.
          </p>
        )}

        {error && (
          <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
            {error}
          </p>
        )}

        {query && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {all.map((photo) => (
              <li key={photo.full}>
                <button
                  type="button"
                  onClick={() => pick(photo)}
                  disabled={saving !== null}
                  className="group relative block aspect-square w-full overflow-hidden rounded-2xl"
                  style={{ background: "var(--bg-sunken)" }}
                  title={[photo.title, photo.credit].filter(Boolean).join(" — ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote search results */}
                  <img
                    src={photo.thumb}
                    alt={photo.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full"
                    style={{ objectFit: kind === "ingredient" ? "contain" : "cover", padding: kind === "ingredient" ? 8 : 0 }}
                    onError={() => setBroken((prev) => new Set(prev).add(photo.thumb))}
                  />
                  <span
                    className="absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-[10px] font-semibold"
                    style={{ background: "linear-gradient(transparent, rgb(0 0 0 / 0.65))", color: "#fff" }}
                  >
                    {PHOTO_SOURCE_LABELS[photo.source]}
                  </span>
                  {saving === photo.full && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
                      style={{ background: "rgb(0 0 0 / 0.55)", color: "#fff" }}
                    >
                      Saving…
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {query && (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {loading.length > 0
              ? `Still searching ${loading.map((s) => PHOTO_SOURCE_LABELS[s]).join(", ")}…`
              : all.length === 0
                ? "No photos found. Try fewer or simpler words, like “pizza” instead of the full dish name."
                : `${all.length} photos. Tap one to use it.`}
            {failed.length > 0 && ` ${failed.map((s) => PHOTO_SOURCE_LABELS[s]).join(", ")} did not answer.`}
          </p>
        )}
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Free-to-use photos from public collections. Fine for your own recipe book; check the source&apos;s licence before
          publishing them anywhere.
        </p>
      </div>
    </Modal>
  );
}
