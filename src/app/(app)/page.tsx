"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { IconPlus, IconSearch } from "@/components/Icons";
import { RecipeMeta } from "@/components/RecipeMeta";
import { Thumb } from "@/components/Thumb";
import { useApi } from "@/lib/use-api";
import type { RecipeSummaryDto } from "@/lib/types";

type Kind = "dishes" | "bases" | "all";

export default function RecipesPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (debounced.trim()) params.set("q", debounced.trim());
  if (kind === "dishes") params.set("components", "exclude");
  if (kind === "bases") params.set("components", "only");
  const { data, error, loading } = useApi<{ recipes: RecipeSummaryDto[] }>(`/api/recipes?${params}`);

  const recipes = data?.recipes;
  const categories = useMemo(
    () => [...new Set((recipes ?? []).map((r) => r.category).filter((c): c is string => !!c))].sort(),
    [recipes],
  );
  const shown = (recipes ?? []).filter((r) => !category || r.category === category);
  const searching = debounced.trim() !== "" || kind !== "all";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-[1.9rem] leading-tight">Recipes</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {recipes ? `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}` : " "}
          </p>
        </div>
        <Link href="/recipe/edit" className="btn btn-primary hidden lg:inline-flex">
          <IconPlus size={16} />
          New recipe
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
            <IconSearch size={17} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: "2.3rem" }}
            placeholder="Search by dish or ingredient"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search recipes"
          />
        </div>
        <div className="seg self-start">
          {(
            [
              ["all", "All"],
              ["dishes", "Dishes"],
              ["bases", "Base recipes"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className="seg-item" data-active={kind === key} onClick={() => setKind(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              className="chip shrink-0"
              onClick={() => setCategory(c)}
              style={
                category === c
                  ? { background: "var(--accent)", color: "var(--accent-text)" }
                  : { background: "var(--bg-sunken)" }
              }
            >
              {c || "All categories"}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="card p-4 text-sm" style={{ color: "var(--debit)" }} role="alert">
          {error}
        </p>
      )}

      {recipes && shown.length === 0 && !loading && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="text-5xl" aria-hidden="true">
            🍕
          </span>
          {searching || category ? (
            <p style={{ color: "var(--text-muted)" }}>No recipes match that.</p>
          ) : (
            <>
              <h2 className="text-xl">Your recipe book is empty</h2>
              <p className="max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
                Add your first dish. Split it into parts (base, sauce, toppings), pick ingredients from the
                library, and add a photo.
              </p>
              <Link href="/recipe/edit" className="btn btn-primary">
                <IconPlus size={16} />
                Add a recipe
              </Link>
            </>
          )}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipe?id=${r.id}`}
              className="card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <Thumb src={r.imageUrl} alt="" fallback="🍽️" radius={0} className="aspect-[4/3] w-full" />
              <span className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
                <span className="flex flex-wrap gap-1">
                  {r.isComponent && (
                    <span className="chip" style={{ background: "var(--warm-soft)", color: "var(--warm)" }}>
                      Base recipe
                    </span>
                  )}
                  {r.category && <span className="chip">{r.category}</span>}
                </span>
                <span className="figure line-clamp-2 text-[1.05rem] leading-snug">{r.name}</span>
                <RecipeMeta prepMinutes={r.prepMinutes} cookMinutes={r.cookMinutes} servings={r.servings} className="mt-auto" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
