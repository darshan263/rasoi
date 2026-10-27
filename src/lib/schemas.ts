import { z } from "zod";

import { isIngredientCategory } from "./categories";
import { isDiet } from "./diet";
import { isAcceptableImageUrl } from "./image-format";
import { cleanName } from "./text";

/** Request bodies for the JSON API. Shared so the API and its tests read the same rules. */

/** Optional free text: trimmed, capped, and null when empty. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters`)
    .nullish()
    .transform((v) => v || null);
}

function optionalCount(label: string, max: number) {
  return z
    .number({ invalid_type_error: `${label} should be a number` })
    .int(`${label} should be a whole number`)
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} looks too large`)
    .nullish()
    .transform((v) => v ?? null);
}

const imageUrl = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || isAcceptableImageUrl(v), "That photo address is not one the app can use");

const name = (label: string, max: number) =>
  z
    .string({ required_error: `${label} is needed` })
    .transform(cleanName)
    .pipe(z.string().min(1, `${label} is needed`).max(max, `${label} can be at most ${max} characters`));

export const ingredientInput = z.object({
  name: name("The ingredient name", 80),
  category: z
    .string()
    .default("other")
    .refine(isIngredientCategory, "Pick a category from the list"),
  /** Left out, the server guesses from the name and category. */
  diet: z.string().refine(isDiet, "Pick Veg or Non-veg").optional(),
  imageUrl,
  defaultUnit: optionalText(20, "The unit"),
});
export type IngredientInput = z.infer<typeof ingredientInput>;

export const ingredientPatch = ingredientInput.partial();

const itemInput = z.object({
  ingredientId: z.string({ required_error: "Pick an ingredient" }).min(1, "Pick an ingredient"),
  quantity: optionalText(30, "A quantity"),
  unit: optionalText(20, "A unit"),
  note: optionalText(120, "An ingredient note"),
});

const sectionInput = z.object({
  title: name("Every section's title", 80),
  instructions: optionalText(8000, "A section's steps"),
  linkedRecipeId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  items: z.array(itemInput).max(100, "A section can have at most 100 ingredients").default([]),
});

export const recipeInput = z.object({
  name: name("The recipe name", 120),
  description: optionalText(1000, "The description"),
  category: optionalText(40, "The category"),
  cuisine: optionalText(40, "The cuisine"),
  servings: optionalCount("Servings", 1000),
  prepMinutes: optionalCount("Prep time", 100_000),
  cookMinutes: optionalCount("Cook time", 100_000),
  notes: optionalText(8000, "The notes"),
  imageUrl,
  isComponent: z.boolean().default(false),
  sections: z.array(sectionInput).max(30, "A recipe can have at most 30 sections").default([]),
});
export type RecipeInput = z.infer<typeof recipeInput>;

export const credentialsInput = z.object({
  email: z.string().trim().toLowerCase().email("That does not look like an email address"),
  password: z.string().min(1, "Enter your password"),
});

export const setupInput = z.object({
  email: z.string().trim().toLowerCase().email("That does not look like an email address"),
  password: z.string().min(10, "Use a password of at least 10 characters").max(200),
});

export const passwordChangeInput = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string().min(10, "Use a new password of at least 10 characters").max(200),
});
