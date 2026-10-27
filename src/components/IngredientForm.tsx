"use client";

import { useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { INGREDIENT_CATEGORIES, UNITS, categoryEmoji } from "@/lib/categories";
import { DIETS, DIET_LABELS, type Diet, guessDiet } from "@/lib/diet";
import type { IngredientDto } from "@/lib/types";
import { DietMark } from "./DietMark";
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
  // A new ingredient follows the guess from its name and category until Veg or Non-veg is
  // tapped; an existing one keeps what it has.
  const [chosenDiet, setChosenDiet] = useState<Diet | null>(initial?.diet ?? null);
  const diet = chosenDiet ?? guessDiet(name, category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { name, category, diet, defaultUnit, imageUrl };
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
      <ImagePicker value={imageUrl} onChange={setImageUrl} variant="square" fallback={categoryEmoji(category)} searchName={name} />

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

      <div>
        <span className="label">Veg or non-veg</span>
        <div className="seg" role="radiogroup" aria-label="Veg or non-veg">
          {DIETS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={diet === d}
              className="seg-item inline-flex items-center gap-1.5"
              data-active={diet === d}
              onClick={() => setChosenDiet(d)}
            >
              <DietMark diet={d} />
              {DIET_LABELS[d]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          {chosenDiet === null
            ? "Guessed from the name and category. Tap to change."
            : "Recipes using it are marked veg or non-veg from this. Eggs count as non-veg."}
        </p>
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
