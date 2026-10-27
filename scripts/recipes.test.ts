/**
 * Tests for the logic that does not need a database. Run with `npm test`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import seed from "../prisma/ingredients.json";
import { isIngredientCategory } from "../src/lib/categories";
import { isAcceptableImageUrl, sniffImage, uploadedImageId } from "../src/lib/image-format";
import { findCycle } from "../src/lib/links";
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
