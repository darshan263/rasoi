/** Lower-cased, trimmed, inner whitespace collapsed: "  Green  Chilli " → "green chilli". */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Display form of a typed name: trimmed, inner whitespace collapsed, case kept. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * How well `name` matches the search `q` (both already passed through `nameKey`); lower is
 * better. Exact, then starts-with, then a word inside starts with it, then anywhere.
 */
export function matchRank(name: string, q: string): number {
  if (!q) return 3;
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(` ${q}`) || name.includes(`(${q}`)) return 2;
  return 3;
}

/** Sort search results so the closest names come first, then alphabetically. */
export function rankByName<T extends { nameKey: string }>(rows: T[], q: string): T[] {
  return [...rows].sort(
    (a, b) => matchRank(a.nameKey, q) - matchRank(b.nameKey, q) || a.nameKey.localeCompare(b.nameKey),
  );
}

/** Instructions are stored one step per line; blank lines and "1." style prefixes are dropped. */
export function splitSteps(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(\d+[.)]|[-*•])\s+/, ""))
    .filter(Boolean);
}
