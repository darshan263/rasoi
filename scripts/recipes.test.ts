/**
 * Tests for the logic that does not need a database. Run with `npm test`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import seed from "../prisma/ingredients.json";
import { isIngredientCategory } from "../src/lib/categories";
import { type DietNode, computeDiets, guessDiet } from "../src/lib/diet";
import { isAcceptableImageUrl, sniffImage, uploadedImageId } from "../src/lib/image-format";
import { findCycle } from "../src/lib/links";
import { isAllowedPhotoUrl } from "../src/lib/photo-hosts";
import { safeNext } from "../src/lib/next-path";
import { ingredientInput, recipeInput } from "../src/lib/schemas";
import { matchRank, nameKey, rankByName, splitSteps } from "../src/lib/text";

test("nameKey folds case and spacing", () => {
  assert.equal(nameKey("  Green   Chilli "), "green chilli");
});

test("search ranks exact, then prefix, then word start, then anywhere", () => {
  const rows = ["cherry tomatoes", "tomato puree", "tomato", "sun-dried tomatoes", "potato"].map((n) => ({ nameKey: n }));
  assert.deepEqual(
    rankByName(rows, "tomato").map((r) => r.nameKey),
    ["tomato", "tomato puree", "cherry tomatoes", "sun-dried tomatoes", "potato"],
  );
  assert.equal(matchRank("rajma (kidney beans)", "kidney"), 2);
});

test("steps split one per line and drop numbering", () => {
  assert.deepEqual(splitSteps("1. Heat oil\n\n2) Add garlic\n- Stir\n  Serve hot  "), ["Heat oil", "Add garlic", "Stir", "Serve hot"]);
  assert.deepEqual(splitSteps(null), []);
});

test("image sniffing trusts bytes, not names", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  assert.equal(sniffImage(webp), "image/webp");
  assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(sniffImage(new Uint8Array([])), null);
});

test("image URLs: own uploads or https only", () => {
  const id = "a".repeat(32);
  assert.equal(uploadedImageId(`/api/images/${id}`), id);
  assert.equal(uploadedImageId("/api/images/../../etc"), null);
  assert.ok(isAcceptableImageUrl(`/api/images/${id}`));
  assert.ok(isAcceptableImageUrl("https://www.themealdb.com/images/ingredients/Tomato-Small.png"));
  assert.ok(!isAcceptableImageUrl("javascript:alert(1)"));
  assert.ok(!isAcceptableImageUrl("http://example.com/a.png"));
  assert.ok(!isAcceptableImageUrl("/somewhere/else.png"));
});

test("linking recipes refuses loops", async () => {
  // pizza → sauce → stock. Making stock use pizza would loop.
  const graph: Record<string, string[]> = { pizza: ["sauce"], sauce: ["stock"], stock: [] };
  const linksOf = async (id: string) => graph[id] ?? [];
  assert.equal(await findCycle("stock", ["pizza"], linksOf), "pizza");
  assert.equal(await findCycle("pizza", ["pizza"], linksOf), "pizza");
  assert.equal(await findCycle("pizza", ["stock"], linksOf), null);
  // Diamonds are fine: two pizzas sharing a sauce.
  graph.pizza2 = ["sauce"];
  assert.equal(await findCycle("pizza2", ["sauce", "stock"], linksOf), null);
});

test("recipe payload: trims, nulls blanks, rejects nonsense", () => {
  const ok = recipeInput.parse({
    name: "  Margherita  ",
    description: "",
    servings: 2,
    sections: [{ title: " Sauce ", items: [{ ingredientId: "x", quantity: "1/2", unit: "cup", note: "" }] }],
  });
  assert.equal(ok.name, "Margherita");
  assert.equal(ok.description, null);
  assert.equal(ok.sections[0].title, "Sauce");
  assert.equal(ok.sections[0].items[0].note, null);
  assert.equal(ok.isComponent, false);

  const bad = (body: unknown) => {
    const r = recipeInput.safeParse(body);
    return r.success ? null : r.error.issues[0]?.message;
  };
  assert.match(bad({ name: "   " }) ?? "", /name is needed/);
  assert.match(bad({ name: "x", servings: -1 }) ?? "", /negative/);
  assert.match(bad({ name: "x", prepMinutes: "ten" }) ?? "", /number/);
  assert.match(bad({ name: "x", imageUrl: "javascript:alert(1)" }) ?? "", /photo/);
  assert.match(bad({ name: "x", sections: [{ title: "" }] }) ?? "", /title is needed/);
});

test("ingredient payload checks the category", () => {
  assert.equal(ingredientInput.parse({ name: "Paneer", category: "dairy" }).category, "dairy");
  assert.ok(!ingredientInput.safeParse({ name: "Paneer", category: "cheese-ish" }).success);
});

test("the seeded library is clean", () => {
  const rows = seed as { name: string; category: string; image: string | null }[];
  assert.ok(rows.length > 900, `only ${rows.length} ingredients`);
  const keys = rows.map((r) => nameKey(r.name));
  assert.equal(new Set(keys).size, keys.length, "duplicate names");
  for (const r of rows) {
    assert.ok(isIngredientCategory(r.category), `${r.name}: bad category ${r.category}`);
    assert.ok(r.image === null || isAcceptableImageUrl(r.image), `${r.name}: bad image`);
  }
  for (const must of ["tomato", "paneer", "mozzarella", "garam masala", "oregano", "basil", "onion"]) {
    assert.ok(keys.includes(must), `missing ${must}`);
  }
});

test("safeNext keeps sign-in redirects on this site", () => {
  assert.equal(safeNext("/recipe?id=abc"), "/recipe?id=abc");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\t/evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
});

test("Find online only downloads from the known photo hosts", () => {
  assert.ok(isAllowedPhotoUrl("https://upload.wikimedia.org/wikipedia/commons/a/a3/Pizza.jpg"));
  assert.ok(isAllowedPhotoUrl("https://www.themealdb.com/images/media/meals/x.jpg"));
  assert.ok(isAllowedPhotoUrl("https://api.openverse.org/v1/images/abc/thumb/"));
  assert.ok(!isAllowedPhotoUrl("http://upload.wikimedia.org/a.jpg"), "plain http");
  assert.ok(!isAllowedPhotoUrl("https://upload.wikimedia.org.evil.com/a.jpg"), "lookalike host");
  assert.ok(!isAllowedPhotoUrl("https://evil.com@upload.wikimedia.org/a.jpg"), "credentials in URL");
  assert.ok(!isAllowedPhotoUrl("https://upload.wikimedia.org:8443/a.jpg"), "odd port");
  assert.ok(!isAllowedPhotoUrl("https://169.254.169.254/latest/meta-data/"), "cloud metadata");
  assert.ok(!isAllowedPhotoUrl("https://localhost/api/images/x"), "localhost");
  assert.ok(!isAllowedPhotoUrl("file:///etc/passwd"));
  assert.ok(!isAllowedPhotoUrl("not a url"));
});

test("ingredient veg / non-veg guesses", () => {
  assert.equal(guessDiet("Chicken Thighs", "meat"), "nonveg");
  assert.equal(guessDiet("Prawns", "seafood"), "nonveg");
  assert.equal(guessDiet("Eggs", "dairy"), "nonveg", "eggs count as non-veg");
  assert.equal(guessDiet("Egg Noodles", "grains"), "nonveg");
  assert.equal(guessDiet("Chicken Stock Cube", "sauces"), "nonveg");
  assert.equal(guessDiet("Gelatine Leafs", "baking"), "nonveg");
  assert.equal(guessDiet("Worcestershire Sauce", "sauces"), "nonveg");
  assert.equal(guessDiet("Paneer", "dairy"), "veg");
  assert.equal(guessDiet("Eggplant", "vegetables"), "veg");
  assert.equal(guessDiet("Egg Plants", "vegetables"), "veg");
  assert.equal(guessDiet("Flax Eggs", "other"), "veg");
  assert.equal(guessDiet("Eggless Mayonnaise", "sauces"), "veg");
  assert.equal(guessDiet("Vegetarian Sausages", "meat"), "veg");
  assert.equal(guessDiet("Fish Masala", "spices"), "veg");
  assert.equal(guessDiet("Vegetable Stock", "sauces"), "veg");
  // Names say non-veg even when filed elsewhere.
  assert.equal(guessDiet("Chicken seekh kebab", "vegetables"), "nonveg");
  assert.equal(guessDiet("Mutton keema", "other"), "nonveg");
  assert.equal(guessDiet("Surmai", "other"), "nonveg");
  // ...and the look-alikes that are not.
  assert.equal(guessDiet("Chickpeas", "pulses"), "veg");
  assert.equal(guessDiet("Beef Tomatoes", "fruits"), "veg");
  assert.equal(guessDiet("Lamb's lettuce", "vegetables"), "veg");
  assert.equal(guessDiet("Soya mince", "other"), "veg");
  assert.equal(guessDiet("Hamburger Buns", "baking"), "veg");
  assert.equal(guessDiet("Coddled cream", "dairy"), "veg");
  assert.equal(guessDiet("Oyster Mushrooms", "vegetables"), "veg");
});

test("seeded library: veg items are not misfiled as meat", () => {
  const rows = seed as { name: string; category: string }[];
  for (const name of ["Bok Choi", "Galangal Paste", "Pistachio", "Rye", "Egg Plants"]) {
    const row = rows.find((r) => r.name === name);
    assert.ok(row, name);
    assert.equal(guessDiet(row.name, row.category), "veg", name);
  }
});

test("recipe veg / non-veg follows ingredients and base recipes", () => {
  const veg = (name: string) => ({ name, diet: "veg" });
  const non = (name: string) => ({ name, diet: "nonveg" });
  const nodes = new Map<string, DietNode>([
    ["sauce", { sections: [{ title: "Sauce", linkedRecipeId: null, items: [veg("Tomato"), veg("Garlic")] }] }],
    ["stock", { sections: [{ title: "Stock", linkedRecipeId: null, items: [non("Chicken Stock")] }] }],
    ["gravy", { sections: [{ title: "Base", linkedRecipeId: "stock", items: [veg("Onion")] }] }],
    ["veg-pizza", { sections: [{ title: "Pizza sauce", linkedRecipeId: "sauce", items: [] }, { title: "Toppings", linkedRecipeId: null, items: [veg("Paneer")] }] }],
    ["chicken-pizza", { sections: [{ title: "Pizza sauce", linkedRecipeId: "sauce", items: [] }, { title: "Toppings", linkedRecipeId: null, items: [non("Chicken"), veg("Onion"), non("Chicken")] }] }],
    ["curry", { sections: [{ title: "Gravy", linkedRecipeId: "gravy", items: [] }] }],
    ["empty", { sections: [{ title: "Notes only", linkedRecipeId: null, items: [] }] }],
    ["empty-link", { sections: [{ title: "Uses empty", linkedRecipeId: "empty", items: [] }] }],
    ["loop-a", { sections: [{ title: "B", linkedRecipeId: "loop-b", items: [veg("Rice")] }] }],
    ["loop-b", { sections: [{ title: "A", linkedRecipeId: "loop-a", items: [] }] }],
  ]);
  const d = computeDiets(nodes);
  assert.equal(d.get("veg-pizza")?.diet, "veg");
  assert.equal(d.get("chicken-pizza")?.diet, "nonveg");
  assert.deepEqual(d.get("chicken-pizza")?.reasons, [{ ingredient: "Chicken", part: "Toppings" }], "listed once");
  // Two levels down: curry → gravy → stock.
  assert.equal(d.get("curry")?.diet, "nonveg");
  assert.deepEqual(d.get("curry")?.reasons, [{ ingredient: "Chicken Stock", part: "Gravy" }]);
  assert.equal(d.get("empty")?.diet, null, "nothing to judge yet");
  assert.equal(d.get("empty-link")?.diet, null);
  // Bad data that loops must still finish.
  assert.equal(d.get("loop-a")?.diet, "veg");
});
