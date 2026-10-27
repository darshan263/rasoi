/** Shapes the JSON API returns. Imported by both the route handlers and the UI. */

import type { Diet, NonVegReason } from "./diet";

export interface IngredientDto {
  id: string;
  name: string;
  category: string;
  diet: Diet;
  imageUrl: string | null;
  defaultUnit: string | null;
}

export interface IngredientDetailDto extends IngredientDto {
  usedIn: { id: string; name: string }[];
}

export interface RecipeSummaryDto {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cuisine: string | null;
  imageUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  isComponent: boolean;
  /** Worked out from the ingredients; null while the recipe has none. */
  diet: Diet | null;
  updatedAt: string;
}

export interface SectionItemDto {
  id: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
  ingredient: IngredientDto;
}

export interface SectionDto {
  id: string;
  title: string;
  instructions: string | null;
  linkedRecipeId: string | null;
  /** The linked base recipe, opened up, when there is one (to a limited depth). */
  linkedRecipe: RecipeDetailDto | null;
  items: SectionItemDto[];
}

export interface RecipeDetailDto extends RecipeSummaryDto {
  notes: string | null;
  createdAt: string;
  sections: SectionDto[];
  /** What makes it non-veg, if it is. */
  nonVegReasons: NonVegReason[];
  /** Recipes that use this one as a section. */
  usedIn: { id: string; name: string }[];
}

export interface MeDto {
  user: { email: string } | null;
  needsSetup: boolean;
}
