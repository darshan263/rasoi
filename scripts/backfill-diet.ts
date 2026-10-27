/**
 * One-time upgrade for a library created before ingredients had Veg / Non-veg: marks each
 * ingredient with the same guess a fresh setup makes, and moves the few seeded ingredients
 * that TheMealDB files in the wrong category.
 *
 *   npx tsx scripts/backfill-diet.ts            (DATABASE_URL from the environment)
 *
 * The category fixes always run (they only move those few names out of the wrong category, and
 * re-mark them). The Veg / Non-veg marking runs once: it stops when any ingredient is already
 * Non-veg, so choices made in the app since are never overwritten. --force runs it anyway.
 */
import { PrismaClient } from "@prisma/client";

import { guessDiet } from "../src/lib/diet";

/** Seeded names TheMealDB filed in the wrong category, and where they belong. */
const CATEGORY_FIXES: Record<string, { from: string[]; to: string }> = {
  "Bok Choi": { from: ["meat", "seafood"], to: "vegetables" },
  "Galangal Paste": { from: ["meat", "seafood"], to: "sauces" },
  Pistachio: { from: ["meat", "seafood"], to: "nuts" },
  Rye: { from: ["meat", "seafood"], to: "grains" },
  "Egg Plants": { from: ["dairy"], to: "vegetables" },
  "Flax Eggs": { from: ["dairy"], to: "other" },
};

const prisma = new PrismaClient();

(async () => {
  let moved = 0;
  for (const [name, fix] of Object.entries(CATEGORY_FIXES)) {
    const { count } = await prisma.ingredient.updateMany({
      where: { name, category: { in: fix.from } },
      data: { category: fix.to, diet: guessDiet(name, fix.to) },
    });
    moved += count;
  }
  console.log(`Moved ${moved} misfiled ingredients.`);

  const already = await prisma.ingredient.count({ where: { diet: "nonveg" } });
  if (already > 0 && !process.argv.includes("--force")) {
    console.log(`${already} ingredients are already Non-veg, so the marking has run before. Left as they are.`);
    return;
  }

  const all = await prisma.ingredient.findMany({ select: { id: true, name: true, category: true, diet: true } });
  const nonVeg = all.filter((i) => i.diet !== "nonveg" && guessDiet(i.name, i.category) === "nonveg");
  await prisma.ingredient.updateMany({ where: { id: { in: nonVeg.map((i) => i.id) } }, data: { diet: "nonveg" } });

  console.log(`Marked ${nonVeg.length} of ${all.length} ingredients Non-veg.`);
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
