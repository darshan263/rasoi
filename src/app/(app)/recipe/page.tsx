"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { IconChevronLeft, IconCopy, IconEdit, IconLink, IconPrinter, IconTrash } from "@/components/Icons";
import { formatMinutes } from "@/components/RecipeMeta";
import { Thumb } from "@/components/Thumb";
import { api, errorMessage } from "@/lib/api-client";
import { categoryEmoji } from "@/lib/categories";
import { splitSteps } from "@/lib/text";
import { useApi } from "@/lib/use-api";
import type { RecipeDetailDto, SectionDto } from "@/lib/types";

function ItemList({ section }: { section: SectionDto }) {
  if (section.items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {section.items.map((it) => (
        <li key={it.id} className="flex items-center gap-3">
          <Thumb src={it.ingredient.imageUrl} alt="" size={40} fallback={categoryEmoji(it.ingredient.category)} fit="contain" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{it.ingredient.name}</span>
            {it.note && (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {" "}
                · {it.note}
              </span>
            )}
          </span>
          {(it.quantity || it.unit) && (
            <span className="tnum shrink-0 text-sm font-semibold">
              {[it.quantity, it.unit].filter(Boolean).join(" ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Steps({ text }: { text: string | null }) {
  const steps = splitSteps(text);
  if (steps.length === 0) return null;
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="step-num">{i + 1}</span>
          <span className="pt-0.5 leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function SectionView({ section, nested = false }: { section: SectionDto; nested?: boolean }) {
  const linked = section.linkedRecipe;
  return (
    <section className={nested ? "flex flex-col gap-3" : "card flex flex-col gap-4 p-4 sm:p-5"}>
      <h2 className={nested ? "text-base" : "text-xl"}>{section.title}</h2>

      {section.linkedRecipeId && (
        <div className="flex flex-col gap-3 rounded-2xl p-3 sm:p-4" style={{ background: "var(--bg-sunken)" }}>
          <Link href={`/recipe?id=${section.linkedRecipeId}`} className="flex items-center gap-3">
            <Thumb src={linked?.imageUrl} alt="" size={44} fallback="🥣" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--warm)" }}>
                <IconLink size={13} />
                Base recipe
              </span>
              <span className="link block truncate">{linked?.name ?? "Open the base recipe"}</span>
            </span>
          </Link>
          {linked?.sections.map((s) => <SectionView key={s.id} section={s} nested />)}
        </div>
      )}

      <ItemList section={section} />
      <Steps text={section.instructions} />
    </section>
  );
}

function RecipeView() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { data: recipe, error, loading } = useApi<RecipeDetailDto>(id ? `/api/recipes/${id}` : null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function duplicate() {
    setBusy(true);
    setActionError(null);
    try {
      const { id: copyId } = await api<{ id: string }>(`/api/recipes/${id}/duplicate`, { method: "POST" });
      router.push(`/recipe/edit?id=${copyId}`);
    } catch (err) {
      setActionError(errorMessage(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!recipe || !confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await api(`/api/recipes/${id}`, { method: "DELETE" });
      router.replace("/");
    } catch (err) {
      setActionError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!id) return <p>No recipe chosen.</p>;
  if (error) {
    return (
      <div className="card p-6">
        <p style={{ color: "var(--debit)" }}>{error}</p>
        <Link href="/" className="link mt-3 inline-block">
          Back to recipes
        </Link>
      </div>
    );
  }
  if (!recipe || loading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/" className="no-print btn btn-ghost btn-sm self-start">
        <IconChevronLeft size={16} />
        Recipes
      </Link>

      {recipe.imageUrl && (
        <Thumb src={recipe.imageUrl} alt={recipe.name} fallback="🍽️" radius={24} className="aspect-[16/9] w-full shadow-[var(--shadow-md)]" />
      )}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {recipe.isComponent && (
            <span className="chip" style={{ background: "var(--warm-soft)", color: "var(--warm)" }}>
              Base recipe
            </span>
          )}
          {recipe.category && <span className="chip">{recipe.category}</span>}
          {recipe.cuisine && <span className="chip">{recipe.cuisine}</span>}
        </div>
        <h1 className="text-[2.1rem] leading-tight">{recipe.name}</h1>
        {recipe.description && (
          <p className="leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {recipe.description}
          </p>
        )}
      </header>

      {(recipe.prepMinutes || recipe.cookMinutes || recipe.servings) && (
        <dl className="card grid grid-cols-3 divide-x text-center">
          {[
            ["Prep", recipe.prepMinutes ? formatMinutes(recipe.prepMinutes) : "—"],
            ["Cook", recipe.cookMinutes ? formatMinutes(recipe.cookMinutes) : "—"],
            ["Serves", recipe.servings ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="px-2 py-3">
              <dt className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>
                {label}
              </dt>
              <dd className="figure text-lg">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <Link href={`/recipe/edit?id=${recipe.id}`} className="btn btn-primary">
          <IconEdit size={16} />
          Edit
        </Link>
        <button type="button" className="btn btn-secondary" onClick={duplicate} disabled={busy}>
          <IconCopy size={16} />
          Make a variant
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <IconPrinter size={16} />
          Print
        </button>
        <button type="button" className="btn btn-danger ml-auto" onClick={remove} disabled={busy}>
          <IconTrash size={16} />
          Delete
        </button>
      </div>
      {actionError && (
        <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
          {actionError}
        </p>
      )}

      {recipe.sections.length === 0 && (
        <p className="card p-5 text-sm" style={{ color: "var(--text-muted)" }}>
          No ingredients or steps yet. Use Edit to add them.
        </p>
      )}
      {recipe.sections.map((s) => (
        <SectionView key={s.id} section={s} />
      ))}

      {recipe.notes && (
        <section className="card flex flex-col gap-2 p-4 sm:p-5">
          <h2 className="text-xl">Notes</h2>
          <p className="leading-relaxed whitespace-pre-line">{recipe.notes}</p>
        </section>
      )}

      {recipe.usedIn.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base">Used in</h2>
          <div className="flex flex-wrap gap-2">
            {recipe.usedIn.map((r) => (
              <Link key={r.id} href={`/recipe?id=${r.id}`} className="chip" style={{ padding: "0.35rem 0.8rem" }}>
                {r.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export default function RecipePage() {
  return (
    <Suspense>
      <RecipeView />
    </Suspense>
  );
}
