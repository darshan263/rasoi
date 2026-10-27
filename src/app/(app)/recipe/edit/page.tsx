"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { DietMark } from "@/components/DietMark";
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconLink, IconPlus, IconTrash, IconX } from "@/components/Icons";
import { ImagePicker } from "@/components/ImagePicker";
import { IngredientSearch } from "@/components/IngredientSearch";
import { RecipePicker } from "@/components/RecipePicker";
import { Thumb } from "@/components/Thumb";
import { api, errorMessage } from "@/lib/api-client";
import { RECIPE_CATEGORIES, UNITS, categoryEmoji } from "@/lib/categories";
import type { Diet, NonVegReason } from "@/lib/diet";
import type { IngredientDto, RecipeDetailDto } from "@/lib/types";

interface ItemDraft {
  key: string;
  ingredient: IngredientDto;
  quantity: string;
  unit: string;
  note: string;
}

interface SectionDraft {
  key: string;
  title: string;
  instructions: string;
  linked: { id: string; name: string; imageUrl: string | null; diet: Diet | null } | null;
  items: ItemDraft[];
}

interface Draft {
  name: string;
  description: string;
  category: string;
  cuisine: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  notes: string;
  imageUrl: string | null;
  isComponent: boolean;
  sections: SectionDraft[];
}

const SECTION_TITLES = [
  "Base / dough",
  "Sauce",
  "Cheese sauce",
  "Toppings",
  "Filling",
  "Marinade",
  "Gravy",
  "Tempering (tadka)",
  "Batter",
  "Dressing",
  "Garnish",
  "To serve",
];

let counter = 0;
const newKey = () => `k${++counter}`;

const emptySection = (title = ""): SectionDraft => ({ key: newKey(), title, instructions: "", linked: null, items: [] });

const EMPTY: Draft = {
  name: "",
  description: "",
  category: "",
  cuisine: "",
  servings: "",
  prepMinutes: "",
  cookMinutes: "",
  notes: "",
  imageUrl: null,
  isComponent: false,
  sections: [],
};

function fromRecipe(r: RecipeDetailDto): Draft {
  const text = (v: number | string | null) => (v === null ? "" : String(v));
  return {
    name: r.name,
    description: text(r.description),
    category: text(r.category),
    cuisine: text(r.cuisine),
    servings: text(r.servings),
    prepMinutes: text(r.prepMinutes),
    cookMinutes: text(r.cookMinutes),
    notes: text(r.notes),
    imageUrl: r.imageUrl,
    isComponent: r.isComponent,
    sections: r.sections.map((s) => ({
      key: newKey(),
      title: s.title,
      instructions: text(s.instructions),
      linked: s.linkedRecipeId
        ? {
            id: s.linkedRecipeId,
            name: s.linkedRecipe?.name ?? "Base recipe",
            imageUrl: s.linkedRecipe?.imageUrl ?? null,
            diet: s.linkedRecipe?.diet ?? null,
          }
        : null,
      items: s.items.map((it) => ({
        key: newKey(),
        ingredient: it.ingredient,
        quantity: text(it.quantity),
        unit: text(it.unit),
        note: text(it.note),
      })),
    })),
  };
}

/**
 * Veg / non-veg for the recipe as it stands in the form, so the mark updates while editing.
 * The server works out the same thing on save (lib/diet.ts); a base recipe counts as one
 * ingredient here, named after itself.
 */
function draftDiet(d: Draft): { diet: Diet | null; reasons: NonVegReason[] } {
  const reasons: NonVegReason[] = [];
  let any = false;
  for (const s of d.sections) {
    const part = s.title.trim() || s.linked?.name || "a part";
    for (const it of s.items) {
      any = true;
      if (it.ingredient.diet === "nonveg") reasons.push({ ingredient: it.ingredient.name, part });
    }
    if (s.linked?.diet) {
      any = true;
      if (s.linked.diet === "nonveg") reasons.push({ ingredient: s.linked.name, part: "base recipe" });
    }
  }
  const seen = new Set<string>();
  const unique = reasons.filter((r) => !seen.has(r.ingredient) && seen.add(r.ingredient));
  return { diet: unique.length ? "nonveg" : any ? "veg" : null, reasons: unique };
}

/** "" → null, "12" → 12, anything else is sent as typed so the server can say what is wrong. */
function count(value: string): number | null | string {
  const v = value.trim();
  if (!v) return null;
  return /^\d+$/.test(v) ? Number(v) : v;
}

function toPayload(d: Draft) {
  return {
    name: d.name,
    description: d.description,
    category: d.category,
    cuisine: d.cuisine,
    servings: count(d.servings),
    prepMinutes: count(d.prepMinutes),
    cookMinutes: count(d.cookMinutes),
    notes: d.notes,
    imageUrl: d.imageUrl,
    isComponent: d.isComponent,
    sections: d.sections.map((s) => ({
      title: s.title.trim() || s.linked?.name || "",
      instructions: s.instructions,
      linkedRecipeId: s.linked?.id ?? null,
      items: s.items.map((it) => ({
        ingredientId: it.ingredient.id,
        quantity: it.quantity,
        unit: it.unit,
        note: it.note,
      })),
    })),
  };
}

function move<T>(list: T[], index: number, by: number): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

type Picker =
  | { kind: "add-items"; section: string }
  | { kind: "replace-item"; section: string; item: string }
  | { kind: "link"; section: string | null };

function Editor({ id }: { id: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(id ? null : { ...EMPTY, sections: [emptySection("Ingredients")] });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!id) return;
    api<RecipeDetailDto>(`/api/recipes/${id}`)
      .then((r) => setDraft(fromRecipe(r)))
      .catch((err) => setLoadError(errorMessage(err)));
  }, [id]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (loadError) {
    return (
      <div className="card p-6">
        <p style={{ color: "var(--debit)" }}>{loadError}</p>
        <Link href="/" className="link mt-3 inline-block">
          Back to recipes
        </Link>
      </div>
    );
  }
  if (!draft) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  function update(change: Partial<Draft> | ((d: Draft) => Draft)) {
    dirty.current = true;
    setDraft((d) => (d ? (typeof change === "function" ? change(d) : { ...d, ...change }) : d));
  }

  function updateSection(key: string, change: (s: SectionDraft) => SectionDraft) {
    update((d) => ({ ...d, sections: d.sections.map((s) => (s.key === key ? change(s) : s)) }));
  }

  function updateItem(sectionKey: string, itemKey: string, change: Partial<ItemDraft>) {
    updateSection(sectionKey, (s) => ({
      ...s,
      items: s.items.map((it) => (it.key === itemKey ? { ...it, ...change } : it)),
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = toPayload(draft);
      const { id: savedId } = id
        ? await api<{ id: string }>(`/api/recipes/${id}`, { method: "PUT", body })
        : await api<{ id: string }>("/api/recipes", { method: "POST", body });
      dirty.current = false;
      router.push(`/recipe?id=${savedId}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const dietNow = draftDiet(draft);
  const pickerSection = picker && "section" in picker ? draft.sections.find((s) => s.key === picker.section) : undefined;

  return (
    <form onSubmit={save} className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href={id ? `/recipe?id=${id}` : "/"} className="btn btn-ghost btn-sm">
          <IconChevronLeft size={16} />
          {id ? "Back" : "Recipes"}
        </Link>
      </div>
      <h1 className="text-[1.9rem] leading-tight">{id ? "Edit recipe" : "New recipe"}</h1>
      <p className="-mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: "var(--text-muted)" }} aria-live="polite">
        {dietNow.diet ? (
          <>
            <DietMark diet={dietNow.diet} size={16} label />
            <span>
              {dietNow.diet === "veg"
                ? "— every ingredient is veg."
                : `— because of ${dietNow.reasons.map((r) => `${r.ingredient} (${r.part})`).join(", ")}.`}
            </span>
          </>
        ) : (
          "Veg or non-veg is worked out from the ingredients you add."
        )}
      </p>

      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <ImagePicker
          value={draft.imageUrl}
          onChange={(imageUrl) => update({ imageUrl })}
          variant="cover"
          fallback="🍽️"
          searchName={draft.name}
        />

        <div>
          <label className="label" htmlFor="name">
            Recipe name
          </label>
          <input
            id="name"
            className="input"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Paneer tikka pizza"
            required
            maxLength={120}
            autoFocus={!id}
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Short description
          </label>
          <textarea
            id="description"
            className="textarea"
            rows={2}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="What it is, and anything worth knowing at a glance"
            maxLength={1000}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <input
              id="category"
              className="input"
              list="recipe-categories"
              value={draft.category}
              onChange={(e) => update({ category: e.target.value })}
              placeholder="Pizza, Curry…"
              maxLength={40}
            />
            <datalist id="recipe-categories">
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="cuisine">
              Cuisine
            </label>
            <input
              id="cuisine"
              className="input"
              value={draft.cuisine}
              onChange={(e) => update({ cuisine: e.target.value })}
              placeholder="Italian, Punjabi…"
              maxLength={40}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["prepMinutes", "Prep (min)"],
              ["cookMinutes", "Cook (min)"],
              ["servings", "Serves"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label className="label" htmlFor={field}>
                {label}
              </label>
              <input
                id={field}
                className="input tnum"
                inputMode="numeric"
                value={draft[field]}
                onChange={(e) => update({ [field]: e.target.value })}
                placeholder="—"
              />
            </div>
          ))}
        </div>

        <label className="flex items-start gap-3 rounded-2xl p-3" style={{ background: "var(--bg-sunken)" }}>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--warm)]"
            checked={draft.isComponent}
            onChange={(e) => update({ isComponent: e.target.checked })}
          />
          <span className="text-sm">
            <span className="font-semibold">This is a base recipe</span>
            <span className="block" style={{ color: "var(--text-muted)" }}>
              A sauce, dough or masala you reuse. Other recipes can include it as one of their parts.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-1">
        <h2 className="text-xl">Parts of the recipe</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Split the dish into parts, like Base, Pizza sauce, Cheese sauce and Toppings. Each part has its own
          ingredients and steps.
        </p>
      </div>

      <datalist id="section-titles">
        {SECTION_TITLES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="unit-options">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {draft.sections.map((section, si) => (
        <section key={section.key} className="card flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <input
              className="input figure flex-1 text-lg"
              list="section-titles"
              value={section.title}
              onChange={(e) => updateSection(section.key, (s) => ({ ...s, title: e.target.value }))}
              placeholder={section.linked?.name ?? "Part name, e.g. Pizza sauce"}
              aria-label="Part name"
              maxLength={80}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Move part up"
              disabled={si === 0}
              onClick={() => update((d) => ({ ...d, sections: move(d.sections, si, -1) }))}
            >
              <IconArrowUp size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Move part down"
              disabled={si === draft.sections.length - 1}
              onClick={() => update((d) => ({ ...d, sections: move(d.sections, si, 1) }))}
            >
              <IconArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Remove part"
              onClick={() => {
                if (section.items.length === 0 && !section.instructions.trim() && !section.linked) {
                  update((d) => ({ ...d, sections: d.sections.filter((s) => s.key !== section.key) }));
                } else if (confirm(`Remove "${section.title || "this part"}" and everything in it?`)) {
                  update((d) => ({ ...d, sections: d.sections.filter((s) => s.key !== section.key) }));
                }
              }}
            >
              <IconTrash size={16} />
            </button>
          </div>

          {section.linked && (
            <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--bg-sunken)" }}>
              <Thumb src={section.linked.imageUrl} alt="" size={44} fallback="🥣" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--warm)" }}>
                  <IconLink size={13} />
                  Uses base recipe
                </span>
                <span className="flex items-center gap-1.5">
                  {section.linked.diet && <DietMark diet={section.linked.diet} size={12} />}
                  <span className="truncate font-medium">{section.linked.name}</span>
                </span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicker({ kind: "link", section: section.key })}>
                Change
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Stop using this base recipe"
                onClick={() => updateSection(section.key, (s) => ({ ...s, linked: null }))}
              >
                <IconX size={16} />
              </button>
            </div>
          )}

          {section.items.length > 0 && (
            <ul className="flex flex-col divide-y">
              {section.items.map((it, ii) => (
                <li key={it.key} className="flex flex-col gap-2 py-3 first:pt-0">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => setPicker({ kind: "replace-item", section: section.key, item: it.key })}
                      title="Change ingredient"
                    >
                      <Thumb src={it.ingredient.imageUrl} alt="" size={42} fallback={categoryEmoji(it.ingredient.category)} fit="contain" />
                      <DietMark diet={it.ingredient.diet} size={12} />
                      <span className="-ml-1.5 truncate font-medium">{it.ingredient.name}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label="Move up"
                      disabled={ii === 0}
                      onClick={() => updateSection(section.key, (s) => ({ ...s, items: move(s.items, ii, -1) }))}
                    >
                      <IconArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Remove ${it.ingredient.name}`}
                      onClick={() => updateSection(section.key, (s) => ({ ...s, items: s.items.filter((x) => x.key !== it.key) }))}
                    >
                      <IconX size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-[5rem_6rem_1fr] gap-2 sm:grid-cols-[6rem_7rem_1fr]">
                    <input
                      className="input tnum"
                      value={it.quantity}
                      onChange={(e) => updateItem(section.key, it.key, { quantity: e.target.value })}
                      placeholder="Qty"
                      aria-label={`${it.ingredient.name} quantity`}
                      maxLength={30}
                    />
                    <input
                      className="input"
                      list="unit-options"
                      value={it.unit}
                      onChange={(e) => updateItem(section.key, it.key, { unit: e.target.value })}
                      placeholder="Unit"
                      aria-label={`${it.ingredient.name} unit`}
                      maxLength={20}
                    />
                    <input
                      className="input"
                      value={it.note}
                      onChange={(e) => updateItem(section.key, it.key, { note: e.target.value })}
                      placeholder="Note (chopped, optional…)"
                      aria-label={`${it.ingredient.name} note`}
                      maxLength={120}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicker({ kind: "add-items", section: section.key })}>
              <IconPlus size={15} />
              Add ingredients
            </button>
            {!section.linked && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicker({ kind: "link", section: section.key })}>
                <IconLink size={15} />
                Use a saved recipe
              </button>
            )}
          </div>

          <div>
            <label className="label" htmlFor={`steps-${section.key}`}>
              Steps <span style={{ fontWeight: 400 }}>— one per line</span>
            </label>
            <textarea
              id={`steps-${section.key}`}
              className="textarea"
              rows={4}
              value={section.instructions}
              onChange={(e) => updateSection(section.key, (s) => ({ ...s, instructions: e.target.value }))}
              placeholder={si === 0 ? "Heat oil in a pan.\nAdd garlic and sauté for 30 seconds." : "Write each step on its own line."}
            />
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => update((d) => ({ ...d, sections: [...d.sections, emptySection()] }))}>
          <IconPlus size={16} />
          Add a part
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setPicker({ kind: "link", section: null })}>
          <IconLink size={16} />
          Add a saved base recipe as a part
        </button>
      </div>

      <section className="card flex flex-col gap-2 p-4 sm:p-5">
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          className="textarea"
          rows={3}
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Tips, variations, where the recipe came from…"
        />
      </section>

      {error && (
        <p className="card p-4 text-sm" style={{ color: "var(--debit)", borderColor: "var(--debit)" }} role="alert">
          {error}
        </p>
      )}

      <div
        className="pb-safe sticky bottom-20 z-20 flex justify-end gap-2 rounded-full border p-2 shadow-[var(--shadow-lg)] lg:bottom-4"
        style={{ background: "var(--bg-elevated)" }}
      >
        <Link href={id ? `/recipe?id=${id}` : "/"} className="btn btn-ghost">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save recipe"}
        </button>
      </div>

      {picker?.kind === "add-items" && pickerSection && (
        <IngredientSearch
          title={`Add to ${pickerSection.title || "this part"}`}
          multiple
          pickedIds={pickerSection.items.map((it) => it.ingredient.id)}
          onClose={() => setPicker(null)}
          onPick={(ingredient) =>
            updateSection(picker.section, (s) =>
              s.items.some((it) => it.ingredient.id === ingredient.id)
                ? s
                : {
                    ...s,
                    items: [...s.items, { key: newKey(), ingredient, quantity: "", unit: ingredient.defaultUnit ?? "", note: "" }],
                  },
            )
          }
        />
      )}

      {picker?.kind === "replace-item" && pickerSection && (
        <IngredientSearch
          title="Change ingredient"
          onClose={() => setPicker(null)}
          onPick={(ingredient) => updateItem(picker.section, picker.item, { ingredient })}
        />
      )}

      {picker?.kind === "link" && (
        <RecipePicker
          excludeId={id}
          onClose={() => setPicker(null)}
          onPick={(recipe) => {
            const linked = { id: recipe.id, name: recipe.name, imageUrl: recipe.imageUrl, diet: recipe.diet };
            if (picker.section) {
              updateSection(picker.section, (s) => ({ ...s, linked, title: s.title || recipe.name }));
            } else {
              update((d) => ({ ...d, sections: [...d.sections, { ...emptySection(recipe.name), linked }] }));
            }
          }}
        />
      )}
    </form>
  );
}

/** Keyed by id, so going from editing one recipe to "New recipe" starts from a clean form. */
function EditorRoute() {
  const id = useSearchParams().get("id");
  return <Editor key={id ?? "new"} id={id} />;
}

export default function EditRecipePage() {
  return (
    <Suspense>
      <EditorRoute />
    </Suspense>
  );
}
