"use client";

import { useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { INGREDIENT_CATEGORIES, UNITS, categoryEmoji } from "@/lib/categories";
import type { IngredientDto } from "@/lib/types";
import { ImagePicker } from "./ImagePicker";

/** Add an ingredient to the library, or edit one. Used by the library page and the recipe editor. */
export function IngredientForm({
  initial,
  initialName = "",
  onSaved,
  onCancel,
}: {
  initial?: IngredientDto;
  initialName?: string;
  onSaved: (ingredient: IngredientDto) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? initialName);
  const [category, setCategory] = useState(initial?.category ?? "vegetables");
  const [defaultUnit, setDefaultUnit] = useState(initial?.defaultUnit ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { name, category, defaultUnit, imageUrl };
      const saved = initial
        ? await api<IngredientDto>(`/api/ingredients/${initial.id}`, { method: "PATCH", body })
        : await api<IngredientDto>("/api/ingredients", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <ImagePicker value={imageUrl} onChange={setImageUrl} variant="square" fallback={categoryEmoji(category)} />

      <div>
        <label className="label" htmlFor="ing-name">
          Name
        </label>
        <input
          id="ing-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cherry tomatoes"
          required
          autoFocus={!initial}
          maxLength={80}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="ing-cat">
            Category
          </label>
          <select id="ing-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {INGREDIENT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ing-unit">
            Usual unit
          </label>
          <input
            id="ing-unit"
            className="input"
            value={defaultUnit}
            onChange={(e) => setDefaultUnit(e.target.value)}
            list="unit-options"
            placeholder="g, tsp, pcs…"
            maxLength={20}
          />
          <datalist id="unit-options">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save" : "Add to library"}
        </button>
      </div>
    </form>
  );
}
