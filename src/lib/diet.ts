/**
 * Veg / non-veg. Ingredients carry it; recipes never store it, they work it out from what is
 * in them (including any base recipes used as parts), so a recipe can never disagree with its
 * own ingredients.
 *
 * Eggs count as non-veg, as on Indian (FSSAI) food labels.
 */

export const DIETS = ["veg", "nonveg"] as const;
export type Diet = (typeof DIETS)[number];

export function isDiet(value: string): value is Diet {
  return (DIETS as readonly string[]).includes(value);
}

export const DIET_LABELS: Record<Diet, string> = { veg: "Veg", nonveg: "Non-veg" };

/**
 * Names that say non-veg wherever the ingredient is filed: a "Chicken seekh kebab" added
 * under Other is still chicken. Meat, fish, eggs, and animal products that hide in other aisles.
 */
const NON_VEG_NAME = new RegExp(
  [
    /chicken|mutton|lamb|beef|veal|pork|bacon|ham|gammon|sausages?|salami|pepperoni|chorizo|prosciutto|pancetta/,
    /turkey|duck|goose|goat|venison|rabbit|keema|meat|mince|liver|kidneys|tripe|oxtail|kebabs?/,
    /fish|prawns?|shrimps?|crabs?|lobsters?|squid|calamari|octopus|mussels|clams|oysters?|scallops?/,
    /tuna|salmon|cod|haddock|mackerel|sardines?|anchov\w*|trout|pomfret|surmai|bombil|hilsa|rohu/,
    /eggs?|egg (yolks?|whites?)|gelatine?|lard|suet|dripping|bonito|dashi|caviar|roe|worcestershire/,
  ]
    .map((r) => r.source)
    .join("|")
    .replace(/^/, "\\b(")
    .concat(")\\b"),
  "i",
);

/** Names that look non-veg but say they are not. Checked first. */
const VEG_SAYS_SO =
  /\b(vegetarian|vegan|veggie|plant[- ]based|meat[- ]free|eggless|egg[- ]free|mock|soya|soy|tofu|quorn|seitan|jackfruit|egg ?plants?|(flax|chia) eggs?|fish (seasoning|masala|spice)|beef tomato(es)?|lamb.?s lettuce|duck sauce|mince ?pies?|mincemeat|oyster mushrooms?|chicken of the woods)\b/i;

/** A starting guess for a new or seeded ingredient. People can always change it. */
export function guessDiet(name: string, category: string): Diet {
  if (VEG_SAYS_SO.test(name)) return "veg";
  if (category === "meat" || category === "seafood") return "nonveg";
  return NON_VEG_NAME.test(name) ? "nonveg" : "veg";
}

/** Why a recipe is non-veg: which ingredient, and in which part. */
export interface NonVegReason {
  ingredient: string;
  part: string;
}

export interface RecipeDiet {
  /** null while the recipe has no ingredients at all, so there is nothing to judge. */
  diet: Diet | null;
  reasons: NonVegReason[];
}

/** What `computeDiets` needs to know about each recipe. */
export interface DietNode {
  sections: {
    title: string;
    linkedRecipeId: string | null;
    items: { name: string; diet: string }[];
  }[];
}

/**
 * Veg / non-veg for every recipe in `nodes`, following base-recipe links. A recipe is non-veg
 * if any ingredient in it, or in any base recipe it uses, is non-veg; veg if it has at least
 * one ingredient anywhere and none is non-veg.
 *
 * Links are refused when they would loop (see links.ts), but a loop is still guarded against
 * here so bad data cannot hang a page.
 */
export function computeDiets(nodes: Map<string, DietNode>): Map<string, RecipeDiet> {
  const done = new Map<string, RecipeDiet>();
  const visiting = new Set<string>();

  function visit(id: string): RecipeDiet {
    const cached = done.get(id);
    if (cached) return cached;
    const node = nodes.get(id);
    if (!node || visiting.has(id)) return { diet: null, reasons: [] };
    visiting.add(id);

    let hasIngredients = false;
    const reasons: NonVegReason[] = [];
    for (const section of node.sections) {
      for (const item of section.items) {
        hasIngredients = true;
        if (item.diet === "nonveg") reasons.push({ ingredient: item.name, part: section.title });
      }
      if (section.linkedRecipeId) {
        const linked = visit(section.linkedRecipeId);
        if (linked.diet !== null) hasIngredients = true;
        for (const r of linked.reasons) reasons.push({ ingredient: r.ingredient, part: section.title });
      }
    }

    // The same ingredient in several parts is listed once, under the first part it appears in.
    const seen = new Set<string>();
    const unique = reasons.filter((r) => !seen.has(r.ingredient) && seen.add(r.ingredient));

    visiting.delete(id);
    const result: RecipeDiet = {
      diet: unique.length > 0 ? "nonveg" : hasIngredients ? "veg" : null,
      reasons: unique,
    };
    done.set(id, result);
    return result;
  }

  for (const id of nodes.keys()) visit(id);
  return done;
}
