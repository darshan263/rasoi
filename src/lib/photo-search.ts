import "server-only";

import { type PhotoResult, type PhotoSource, isAllowedPhotoUrl } from "./photo-hosts";

/**
 * Search free photo sources for a dish or ingredient name. Each source is asked separately
 * (the picker calls them in parallel and shows each as it answers), because they differ a lot
 * in speed: TheMealDB and Wikimedia answer in about a second, Openverse can take fifteen.
 *
 * Wikimedia Commons and Openverse are free to use with no key. Pexels has the best food photos
 * and is used when PEXELS_API_KEY is set (a free key from pexels.com/api).
 */

const USER_AGENT = "Rasoi/1.0 (private recipe book)";

async function getJson<T>(url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return (await res.json()) as T;
}

async function mealdb(q: string, kind: "recipe" | "ingredient"): Promise<PhotoResult[]> {
  if (kind === "ingredient") {
    // Ingredient photos live at a fixed address per name; try the name as typed and in Title Case.
    const titled = q.replace(/\b\w/g, (c) => c.toUpperCase());
    const names = [...new Set([titled, q])];
    const found: PhotoResult[] = [];
    for (const name of names) {
      const full = `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name)}.png`;
      const res = await fetch(full, { method: "HEAD", signal: AbortSignal.timeout(5000) }).catch(() => null);
      if (res?.ok) {
        found.push({ thumb: full.replace(/\.png$/, "-Small.png"), full, source: "mealdb", title: name, credit: null });
        break;
      }
    }
    return found;
  }

  type Meals = { meals: { strMeal: string; strMealThumb: string }[] | null };
  let { meals } = await getJson<Meals>(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`, 6000);
  // "Paneer tikka pizza" finds nothing; its last word usually names the dish.
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (!meals && words.length > 1) {
    ({ meals } = await getJson<Meals>(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(words[words.length - 1])}`,
      6000,
    ));
  }
  return (meals ?? []).slice(0, 8).map((m) => ({
    thumb: `${m.strMealThumb}/medium`,
    full: m.strMealThumb,
    source: "mealdb" as const,
    title: m.strMeal,
    credit: null,
  }));
}

async function wikimedia(q: string): Promise<PhotoResult[]> {
  type Page = {
    index: number;
    title: string;
    imageinfo?: { thumburl?: string; responsiveUrls?: Record<string, string>; user?: string }[];
  };
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${q} filetype:bitmap`,
    gsrlimit: "16",
    prop: "imageinfo",
    iiprop: "url|user",
    iiurlwidth: "500",
    format: "json",
    origin: "*",
  });
  const data = await getJson<{ query?: { pages: Record<string, Page> } }>(
    `https://commons.wikimedia.org/w/api.php?${params}`,
    8000,
  );
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) return [];
      const full = info.responsiveUrls?.["2"] ?? info.responsiveUrls?.["1.5"] ?? info.thumburl;
      return [
        {
          thumb: info.thumburl,
          full,
          source: "wikimedia" as const,
          title: p.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
          credit: info.user ? `${info.user} · Wikimedia Commons` : "Wikimedia Commons",
        },
      ];
    });
}

async function openverse(q: string): Promise<PhotoResult[]> {
  type Result = { thumbnail: string; title: string | null; creator: string | null; license: string; license_version: string | null };
  const params = new URLSearchParams({ q, page_size: "16", mature: "false" });
  const data = await getJson<{ results: Result[] }>(`https://api.openverse.org/v1/images/?${params}`, 20000);
  return data.results.map((r) => ({
    // The thumbnail proxy is on Openverse's own host; originals are scattered across Flickr etc.
    thumb: r.thumbnail,
    full: r.thumbnail,
    source: "openverse" as const,
    title: r.title ?? q,
    credit: [r.creator, `CC ${r.license.toUpperCase()} ${r.license_version ?? ""}`.trim()].filter(Boolean).join(" · "),
  }));
}

async function pexels(q: string): Promise<PhotoResult[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  type Photo = { alt: string; photographer: string; src: { medium: string; large: string } };
  const data = await getJson<{ photos: Photo[] }>(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=16`,
    8000,
    { Authorization: key },
  );
  return data.photos.map((p) => ({
    thumb: p.src.medium,
    full: p.src.large,
    source: "pexels" as const,
    title: p.alt || q,
    credit: `${p.photographer} · Pexels`,
  }));
}

export function isSourceEnabled(source: PhotoSource): boolean {
  return source !== "pexels" || !!process.env.PEXELS_API_KEY;
}

export async function searchPhotos(source: PhotoSource, q: string, kind: "recipe" | "ingredient"): Promise<PhotoResult[]> {
  const results =
    source === "mealdb"
      ? await mealdb(q, kind)
      : source === "wikimedia"
        ? await wikimedia(q)
        : source === "openverse"
          ? await openverse(q)
          : await pexels(q);
  // Only offer what the download endpoint will agree to fetch.
  return results.filter((r) => isAllowedPhotoUrl(r.full));
}

/**
 * Download a picked photo. Redirects are followed by hand so every hop is checked against the
 * allowed hosts, and the body is capped while it streams in rather than after.
 */
export async function downloadPhoto(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; type: string }> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedPhotoUrl(current)) throw new Error("That photo is not from a source the app downloads from");
    const res = await fetch(current, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("The photo source sent an empty redirect");
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`The photo source answered ${res.status}`);

    const declared = Number(res.headers.get("content-length"));
    if (declared > maxBytes) throw new Error("That photo is too large to download");

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("That photo is too large to download");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return { bytes, type: res.headers.get("content-type") ?? "" };
  }
  throw new Error("The photo source redirected too many times");
}
