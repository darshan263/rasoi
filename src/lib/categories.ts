/** Ingredient library categories. The keys are stored; labels and emoji are display only. */
export const INGREDIENT_CATEGORIES = [
  { key: "vegetables", label: "Vegetables", emoji: "🥕" },
  { key: "fruits", label: "Fruits", emoji: "🍎" },
  { key: "dairy", label: "Dairy & eggs", emoji: "🧀" },
  { key: "spices", label: "Spices", emoji: "🌶️" },
  { key: "herbs", label: "Herbs", emoji: "🌿" },
  { key: "grains", label: "Rice, grains & pasta", emoji: "🍚" },
  { key: "baking", label: "Flour, bread & baking", emoji: "🍞" },
  { key: "pulses", label: "Dals, beans & pulses", emoji: "🫘" },
  { key: "sauces", label: "Sauces & pastes", emoji: "🥫" },
  { key: "oils", label: "Oils & fats", emoji: "🫒" },
  { key: "nuts", label: "Nuts & seeds", emoji: "🥜" },
  { key: "sweet", label: "Sugar & sweet", emoji: "🍯" },
  { key: "meat", label: "Meat", emoji: "🍗" },
  { key: "seafood", label: "Fish & seafood", emoji: "🐟" },
  { key: "drinks", label: "Drinks & liquids", emoji: "🥛" },
  { key: "other", label: "Other", emoji: "🧂" },
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number]["key"];

const BY_KEY = new Map<string, (typeof INGREDIENT_CATEGORIES)[number]>(
  INGREDIENT_CATEGORIES.map((c) => [c.key, c]),
);

export function isIngredientCategory(value: string): value is IngredientCategory {
  return BY_KEY.has(value);
}

export function categoryLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? "Other";
}

export function categoryEmoji(key: string): string {
  return BY_KEY.get(key)?.emoji ?? "🧂";
}

/** Suggestions for the recipe category field. Any other text is accepted too. */
export const RECIPE_CATEGORIES = [
  "Pizza",
  "Pasta",
  "Breakfast",
  "Starter",
  "Main course",
  "Curry",
  "Dal",
  "Rice",
  "Bread",
  "Snack",
  "Street food",
  "Salad",
  "Soup",
  "Sandwich",
  "Dessert",
  "Drink",
  "Sauce / base",
];

/** Suggestions for an ingredient line's unit. Any other text is accepted too. */
export const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "pcs",
  "slices",
  "cloves",
  "inch",
  "bunch",
  "pinch",
  "to taste",
];
