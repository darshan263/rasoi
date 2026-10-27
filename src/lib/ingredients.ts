import "server-only";

import type { Ingredient, Prisma } from "@prisma/client";

import seed from "../../prisma/ingredients.json";
import { prisma } from "./db";
import { nameKey, rankByName } from "./text";
import type { IngredientDto } from "./types";

export function toIngredientDto(i: Ingredient): IngredientDto {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    imageUrl: i.imageUrl,
    defaultUnit: i.defaultUnit,
  };
}

/** The starter library: ~1,000 ingredients, most with a photo. See prisma/ingredients.json. */
export function seedIngredientRows(): Prisma.IngredientCreateManyInput[] {
  return (seed as { name: string; category: string; image: string | null }[]).map((s) => ({
    name: s.name,
    nameKey: nameKey(s.name),
    category: s.category,
    imageUrl: s.image,
  }));
}

/**
 * Search the library. With a query, the closest names come first ("tom" → Tomato before
 * Cherry Tomatoes); without one, alphabetical. `offset`/`limit` page through the result.
 */
export async function searchIngredients({
  q,
  category,
  limit,
  offset = 0,
}: {
  q: string;
  category?: string;
  limit: number;
  offset?: number;
}): Promise<{ items: IngredientDto[]; total: number }> {
  const key = nameKey(q);
  const where: Prisma.IngredientWhereInput = {
    ...(key ? { nameKey: { contains: key } } : {}),
    ...(category ? { category } : {}),
  };

  if (!key) {
    const [rows, total] = await Promise.all([
      prisma.ingredient.findMany({ where, orderBy: { nameKey: "asc" }, skip: offset, take: limit }),
      prisma.ingredient.count({ where }),
    ]);
    return { items: rows.map(toIngredientDto), total };
  }

  // Ranking happens here rather than in SQL, so fetch every match. A substring of a library
  // of a thousand names matches a few dozen at most.
  const rows = rankByName(await prisma.ingredient.findMany({ where, take: 500 }), key);
  return { items: rows.slice(offset, offset + limit).map(toIngredientDto), total: rows.length };
}
