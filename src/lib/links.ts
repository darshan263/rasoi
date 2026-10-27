/**
 * Recipes can use other recipes as sections (a pizza uses "Pizza sauce"). A chain that comes
 * back to where it started would make a recipe contain itself, so saving one is refused.
 *
 * `linksOf(id)` returns the recipe ids that recipe `id` currently uses as sections.
 * Returns the id of a proposed link that leads back to `recipeId`, or null if none does.
 */
export async function findCycle(
  recipeId: string,
  proposedLinks: string[],
  linksOf: (id: string) => Promise<string[]>,
): Promise<string | null> {
  for (const start of proposedLinks) {
    if (start === recipeId) return start;
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of await linksOf(current)) {
        if (next === recipeId) return start;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  return null;
}
