import "server-only";

import type { Prisma, Recipe } from "@prisma/client";

import { prisma } from "./db";
import { type Diet, type RecipeDiet, computeDiets } from "./diet";
import { ApiError } from "./http";
import { releaseImage } from "./images";
import { toIngredientDto } from "./ingredients";
import { findCycle } from "./links";
import type { RecipeInput } from "./schemas";
import { nameKey } from "./text";
import type { RecipeDetailDto, RecipeSummaryDto } from "./types";

/** How many levels of base recipes are opened up inside a recipe (pizza → sauce → stock). */
const LINK_DEPTH = 3;

/**
 * Veg / non-veg for every recipe, worked out from the ingredients (see diet.ts). Reads every
 * recipe's ingredient list in one query rather than storing the answer: a personal recipe book
 * is small, and this way changing an ingredient or a base recipe can never leave a recipe
 * showing the wrong mark.
 */
export async function loadDiets(): Promise<Map<string, RecipeDiet>> {
  const rows = await prisma.recipe.findMany({
    select: {
      id: true,
      sections: {
        orderBy: { position: "asc" },
        select: {
          title: true,
          linkedRecipeId: true,
          items: { orderBy: { position: "asc" }, select: { ingredient: { select: { name: true, diet: true } } } },
        },
      },
    },
  });
  return computeDiets(
    new Map(
      rows.map((r) => [
        r.id,
        {
          sections: r.sections.map((s) => ({
            title: s.title,
            linkedRecipeId: s.linkedRecipeId,
            items: s.items.map((i) => i.ingredient),
          })),
        },
      ]),
    ),
  );
}

export function toRecipeSummary(r: Recipe, diet: Diet | null): RecipeSummaryDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    cuisine: r.cuisine,
    imageUrl: r.imageUrl,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    isComponent: r.isComponent,
    diet,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listRecipes({
  q,
  category,
  components,
  diet,
}: {
  q: string;
  category?: string;
  components?: "only" | "exclude";
  diet?: Diet;
}): Promise<RecipeSummaryDto[]> {
  const key = nameKey(q);
  const where: Prisma.RecipeWhereInput = {
    ...(category ? { category } : {}),
    ...(components === "only" ? { isComponent: true } : {}),
    ...(components === "exclude" ? { isComponent: false } : {}),
    // A search finds a recipe by its name or by anything in it: "paneer" finds every paneer dish.
    ...(key
      ? {
          OR: [
            { nameKey: { contains: key } },
            { sections: { some: { items: { some: { ingredient: { nameKey: { contains: key } } } } } } },
          ],
        }
      : {}),
  };
  const [rows, diets] = await Promise.all([
    prisma.recipe.findMany({ where, orderBy: { updatedAt: "desc" }, take: 500 }),
    loadDiets(),
  ]);
  return rows
    .map((r) => toRecipeSummary(r, diets.get(r.id)?.diet ?? null))
    .filter((r) => !diet || r.diet === diet);
}

const sectionInclude = {
  orderBy: { position: "asc" },
  include: {
    items: { orderBy: { position: "asc" }, include: { ingredient: true } },
  },
} satisfies Prisma.Recipe$sectionsArgs;

/** One recipe, with its sections, and any base recipes it uses opened up inside them. */
export async function loadRecipe(
  id: string,
  depth = 0,
  diets?: Map<string, RecipeDiet>,
): Promise<RecipeDetailDto | null> {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      sections: sectionInclude,
      usedIn: { select: { recipe: { select: { id: true, name: true } } } },
    },
  });
  if (!recipe) return null;

  diets ??= await loadDiets();
  const usedIn = new Map(recipe.usedIn.map((s) => [s.recipe.id, s.recipe]));

  return {
    ...toRecipeSummary(recipe, diets.get(id)?.diet ?? null),
    nonVegReasons: diets.get(id)?.reasons ?? [],
    notes: recipe.notes,
    createdAt: recipe.createdAt.toISOString(),
    usedIn: [...usedIn.values()],
    sections: await Promise.all(
      recipe.sections.map(async (s) => ({
        id: s.id,
        title: s.title,
        instructions: s.instructions,
        linkedRecipeId: s.linkedRecipeId,
        linkedRecipe:
          s.linkedRecipeId && depth < LINK_DEPTH ? await loadRecipe(s.linkedRecipeId, depth + 1, diets) : null,
        items: s.items.map((it) => ({
          id: it.id,
          quantity: it.quantity,
          unit: it.unit,
          note: it.note,
          ingredient: toIngredientDto(it.ingredient),
        })),
      })),
    ),
  };
}

async function linksOf(id: string): Promise<string[]> {
  const rows = await prisma.recipeSection.findMany({
    where: { recipeId: id, linkedRecipeId: { not: null } },
    select: { linkedRecipeId: true },
  });
  return rows.map((r) => r.linkedRecipeId!);
}

/** Everything a recipe refers to has to exist, and links may not loop back. */
async function checkReferences(input: RecipeInput, recipeId: string | null): Promise<void> {
  const ingredientIds = [...new Set(input.sections.flatMap((s) => s.items.map((i) => i.ingredientId)))];
  if (ingredientIds.length > 0) {
    const found = await prisma.ingredient.count({ where: { id: { in: ingredientIds } } });
    if (found !== ingredientIds.length) {
      throw new ApiError(400, "An ingredient in this recipe was removed from the library. Pick it again.");
    }
  }

  const linkIds = [...new Set(input.sections.map((s) => s.linkedRecipeId).filter((v): v is string => !!v))];
  if (linkIds.length === 0) return;

  const linked = await prisma.recipe.findMany({ where: { id: { in: linkIds } }, select: { id: true, name: true } });
  if (linked.length !== linkIds.length) {
    throw new ApiError(400, "A base recipe used in a section no longer exists. Pick it again.");
  }
  if (recipeId) {
    const loop = await findCycle(recipeId, linkIds, linksOf);
    if (loop) {
      const name = linked.find((l) => l.id === loop)?.name ?? "That recipe";
      throw new ApiError(
        400,
        loop === recipeId
          ? "A recipe cannot use itself as a section."
          : `"${name}" already uses this recipe, so it cannot also be a section of it.`,
      );
    }
  }
}

function recipeData(input: RecipeInput) {
  return {
    name: input.name,
    nameKey: nameKey(input.name),
    description: input.description,
    category: input.category,
    cuisine: input.cuisine,
    servings: input.servings,
    prepMinutes: input.prepMinutes,
    cookMinutes: input.cookMinutes,
    notes: input.notes,
    imageUrl: input.imageUrl,
    isComponent: input.isComponent,
  };
}

async function writeSections(tx: Prisma.TransactionClient, recipeId: string, input: RecipeInput) {
  for (const [position, s] of input.sections.entries()) {
    await tx.recipeSection.create({
      data: {
        recipeId,
        position,
        title: s.title,
        instructions: s.instructions,
        linkedRecipeId: s.linkedRecipeId,
        items: {
          create: s.items.map((it, i) => ({
            position: i,
            ingredientId: it.ingredientId,
            quantity: it.quantity,
            unit: it.unit,
            note: it.note,
          })),
        },
      },
    });
  }
}

export async function createRecipe(input: RecipeInput): Promise<string> {
  await checkReferences(input, null);
  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({ data: recipeData(input) });
    await writeSections(tx, recipe.id, input);
    return recipe.id;
  });
}

/** Replace a recipe's details and all of its sections with what was sent. */
export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  const existing = await prisma.recipe.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!existing) throw new ApiError(404, "That recipe no longer exists");
  await checkReferences(input, id);

  await prisma.$transaction(async (tx) => {
    await tx.recipe.update({ where: { id }, data: recipeData(input) });
    await tx.recipeSection.deleteMany({ where: { recipeId: id } });
    await writeSections(tx, id, input);
  });

  if (existing.imageUrl !== input.imageUrl) await releaseImage(existing.imageUrl);
}

export async function deleteRecipe(id: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: { imageUrl: true, usedIn: { select: { recipe: { select: { name: true } } } } },
  });
  if (!recipe) throw new ApiError(404, "That recipe no longer exists");
  if (recipe.usedIn.length > 0) {
    const names = [...new Set(recipe.usedIn.map((s) => s.recipe.name))].join(", ");
    throw new ApiError(409, `This is used as a section in: ${names}. Remove it from there first.`);
  }
  await prisma.recipe.delete({ where: { id } });
  await releaseImage(recipe.imageUrl);
}

/** A copy to start a variant from ("Margherita" → "Margherita (copy)"). Shares the photo. */
export async function duplicateRecipe(id: string): Promise<string> {
  const source = await prisma.recipe.findUnique({ where: { id }, include: { sections: sectionInclude } });
  if (!source) throw new ApiError(404, "That recipe no longer exists");

  const name = `${source.name} (copy)`.slice(0, 120);
  return createRecipe({
    ...source,
    name,
    sections: source.sections.map((s) => ({
      title: s.title,
      instructions: s.instructions,
      linkedRecipeId: s.linkedRecipeId,
      items: s.items.map((it) => ({
        ingredientId: it.ingredientId,
        quantity: it.quantity,
        unit: it.unit,
        note: it.note,
      })),
    })),
  });
}
