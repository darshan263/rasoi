"use client";

import { useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { INGREDIENT_CATEGORIES, categoryEmoji, categoryLabel } from "@/lib/categories";
import type { IngredientDto } from "@/lib/types";
import { IconPlus, IconSearch } from "./Icons";
import { IngredientForm } from "./IngredientForm";
import { Modal } from "./Modal";
import { Thumb } from "./Thumb";

/**
 * Search the ingredient library and pick from it. Typing narrows the list as you go; anything
 * not in the library can be added on the spot, photo and all.
 *
 * `multiple` keeps the sheet open so several ingredients can be added in a row (all of a
 * pizza's toppings); `pickedIds` marks the ones already added.
 */
export function IngredientSearch({
  title,
  onPick,
  onClose,
  multiple = false,
  pickedIds = [],
}: {
  title: string;
  onPick: (ingredient: IngredientDto) => void;
  onClose: () => void;
  multiple?: boolean;
  pickedIds?: string[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<IngredientDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(pickedIds));
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: "40" });
        if (category) params.set("category", category);
        const data = await api<{ items: IngredientDto[] }>(`/api/ingredients?${params}`);
        // A slower answer to an older query must not replace a newer one.
        if (id !== request.current) return;
        setResults(data.items);
        setActive(0);
        setError(null);
      } catch (err) {
        if (id === request.current) setError(errorMessage(err));
      } finally {
        if (id === request.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [q, category]);

  function choose(ingredient: IngredientDto) {
    onPick(ingredient);
    if (multiple) {
      setPicked((prev) => new Set(prev).add(ingredient.id));
    } else {
      onClose();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
      else if (q.trim()) setCreating(true);
    }
  }

  const exact = results.some((r) => r.name.toLowerCase() === q.trim().toLowerCase());

  if (creating) {
    return (
      <Modal title="Add to the library" onClose={() => setCreating(false)}>
        <IngredientForm
          initialName={q.trim()}
          onCancel={() => setCreating(false)}
          onSaved={(ingredient) => {
            setCreating(false);
            setQ("");
            choose(ingredient);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
            <IconSearch size={17} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: "2.3rem" }}
            placeholder="Search: tomato, paneer, oregano…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            aria-label="Search ingredients"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" className="chip shrink-0" onClick={() => setCategory("")} style={chipStyle(!category)}>
            All
          </button>
          {INGREDIENT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className="chip shrink-0"
              onClick={() => setCategory(category === c.key ? "" : c.key)}
              style={chipStyle(category === c.key)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
            {error}
          </p>
        )}

        <ul className="flex min-h-[12rem] flex-col gap-1" role="listbox" aria-label="Ingredients">
          {results.map((r, i) => {
            const isPicked = picked.has(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onClick={() => choose(r)}
                  onMouseEnter={() => setActive(i)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left"
                  style={{ background: i === active ? "var(--bg-hover)" : undefined }}
                >
                  <Thumb src={r.imageUrl} alt="" size={44} fallback={categoryEmoji(r.category)} fit="contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                      {categoryLabel(r.category)}
                    </span>
                  </span>
                  {isPicked && (
                    <span className="chip" style={{ background: "var(--warm-soft)", color: "var(--warm)" }}>
                      Added
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {!loading && results.length === 0 && !q.trim() && (
            <li className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Nothing in this category yet.
            </li>
          )}
        </ul>

        {q.trim() && !exact && (
          <button type="button" className="btn btn-secondary w-full" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
            Add “{q.trim()}” to the library
          </button>
        )}

        {multiple && (
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>
            Done
          </button>
        )}
      </div>
    </Modal>
  );
}

function chipStyle(on: boolean): React.CSSProperties {
  return on
    ? { background: "var(--accent)", color: "var(--accent-text)" }
    : { background: "var(--bg-sunken)", color: "var(--text-muted)" };
}
