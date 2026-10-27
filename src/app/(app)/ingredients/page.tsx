"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { IconPlus, IconSearch, IconTrash } from "@/components/Icons";
import { IngredientForm } from "@/components/IngredientForm";
import { Modal } from "@/components/Modal";
import { Thumb } from "@/components/Thumb";
import { api, errorMessage } from "@/lib/api-client";
import { INGREDIENT_CATEGORIES, categoryEmoji, categoryLabel } from "@/lib/categories";
import type { IngredientDetailDto, IngredientDto } from "@/lib/types";

const PAGE = 60;

type Editing = { mode: "new"; name: string } | { mode: "edit"; ingredient: IngredientDetailDto };

export default function IngredientsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<IngredientDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ q: debounced, limit: String(PAGE), offset: "0" });
    if (category) params.set("category", category);
    api<{ items: IngredientDto[]; total: number }>(`/api/ingredients?${params}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, category, version]);

  async function loadMore() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: debounced, limit: String(PAGE), offset: String(items.length) });
      if (category) params.set("category", category);
      const data = await api<{ items: IngredientDto[]; total: number }>(`/api/ingredients?${params}`);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function openEdit(ingredient: IngredientDto) {
    setDeleteError(null);
    try {
      const detail = await api<IngredientDetailDto>(`/api/ingredients/${ingredient.id}`);
      setEditing({ mode: "edit", ingredient: detail });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(ingredient: IngredientDetailDto) {
    if (!confirm(`Remove "${ingredient.name}" from the library?`)) return;
    try {
      await api(`/api/ingredients/${ingredient.id}`, { method: "DELETE" });
      setEditing(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-[1.9rem] leading-tight">Ingredients</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Your library. Everything here can be picked when writing a recipe.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: "new", name: q.trim() })}>
          <IconPlus size={16} />
          Add ingredient
        </button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
          <IconSearch size={17} />
        </span>
        <input
          className="input"
          style={{ paddingLeft: "2.3rem" }}
          placeholder="Search ingredients"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search ingredients"
        />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ key: "", label: "All", emoji: "" }, ...INGREDIENT_CATEGORIES].map((c) => (
          <button
            key={c.key || "all"}
            type="button"
            className="chip shrink-0"
            onClick={() => setCategory(c.key)}
            style={
              category === c.key
                ? { background: "var(--accent)", color: "var(--accent-text)" }
                : { background: "var(--bg-sunken)" }
            }
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="card p-4 text-sm" style={{ color: "var(--debit)" }} role="alert">
          {error}
        </p>
      )}

      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        {loading && items.length === 0 ? "Loading…" : `${total} ${total === 1 ? "ingredient" : "ingredients"}`}
      </p>

      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {items.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => openEdit(i)}
              className="card flex h-full w-full flex-col items-center gap-1.5 p-2.5 text-center transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <Thumb src={i.imageUrl} alt="" fallback={categoryEmoji(i.category)} fit="contain" radius={14} className="aspect-square w-full" />
              <span className="line-clamp-2 text-sm leading-tight font-medium">{i.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && debounced && (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <p style={{ color: "var(--text-muted)" }}>“{debounced}” is not in the library yet.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: "new", name: debounced })}>
            <IconPlus size={16} />
            Add “{debounced}”
          </button>
        </div>
      )}

      {items.length < total && (
        <button type="button" className="btn btn-secondary self-center" onClick={loadMore} disabled={loading}>
          {loading ? "Loading…" : `Show more (${total - items.length} left)`}
        </button>
      )}

      {editing?.mode === "new" && (
        <Modal title="Add an ingredient" onClose={() => setEditing(null)}>
          <IngredientForm
            initialName={editing.name}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setVersion((v) => v + 1);
            }}
          />
        </Modal>
      )}

      {editing?.mode === "edit" && (
        <Modal title={editing.ingredient.name} onClose={() => setEditing(null)}>
          <div className="flex flex-col gap-5">
            <IngredientForm
              initial={editing.ingredient}
              onCancel={() => setEditing(null)}
              onSaved={(saved) => {
                setEditing(null);
                setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
              }}
            />
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {categoryLabel(editing.ingredient.category)} ·{" "}
                {editing.ingredient.usedIn.length === 0
                  ? "not used in any recipe yet"
                  : `used in ${editing.ingredient.usedIn.length} ${editing.ingredient.usedIn.length === 1 ? "recipe" : "recipes"}`}
              </p>
              {editing.ingredient.usedIn.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {editing.ingredient.usedIn.map((r) => (
                    <Link key={r.id} href={`/recipe?id=${r.id}`} className="chip">
                      {r.name}
                    </Link>
                  ))}
                </div>
              )}
              {editing.ingredient.usedIn.length === 0 && (
                <button type="button" className="btn btn-danger btn-sm self-start" onClick={() => remove(editing.ingredient)}>
                  <IconTrash size={15} />
                  Remove from library
                </button>
              )}
              {deleteError && (
                <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
                  {deleteError}
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
