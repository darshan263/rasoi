"use client";

import { useEffect, useState } from "react";

import { useApi } from "@/lib/use-api";
import type { RecipeSummaryDto } from "@/lib/types";
import { IconSearch } from "./Icons";
import { Modal } from "./Modal";
import { Thumb } from "./Thumb";

/** Choose a saved recipe to use as a section, base recipes first. */
export function RecipePicker({
  excludeId,
  onPick,
  onClose,
}: {
  excludeId: string | null;
  onPick: (recipe: RecipeSummaryDto) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [all, setAll] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (debounced.trim()) params.set("q", debounced.trim());
  if (!all) params.set("components", "only");
  const { data, loading } = useApi<{ recipes: RecipeSummaryDto[] }>(`/api/recipes?${params}`);
  const recipes = (data?.recipes ?? []).filter((r) => r.id !== excludeId);

  return (
    <Modal title="Use a saved recipe" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Its ingredients and steps show inside this recipe and stay in step when you edit it.
        </p>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
            <IconSearch size={17} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: "2.3rem" }}
            placeholder="Search recipes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="seg self-start">
          <button type="button" className="seg-item" data-active={!all} onClick={() => setAll(false)}>
            Base recipes
          </button>
          <button type="button" className="seg-item" data-active={all} onClick={() => setAll(true)}>
            All recipes
          </button>
        </div>
        <ul className="flex min-h-[10rem] flex-col gap-1">
          {recipes.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-[var(--bg-hover)]"
                onClick={() => {
                  onPick(r);
                  onClose();
                }}
              >
                <Thumb src={r.imageUrl} alt="" size={44} fallback="🥣" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  {r.category && (
                    <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                      {r.category}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!loading && recipes.length === 0 && (
            <li className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {all
                ? "No other recipes yet."
                : "No base recipes yet. Save a sauce or dough with “This is a base recipe” ticked, or switch to All recipes."}
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
