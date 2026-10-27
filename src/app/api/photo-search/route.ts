import { ApiError, json, requireUser, route } from "@/lib/http";
import { PHOTO_SOURCES, type PhotoSource } from "@/lib/photo-hosts";
import { isSourceEnabled, searchPhotos } from "@/lib/photo-search";

export const dynamic = "force-dynamic";

/** GET /api/photo-search?source=wikimedia&kind=recipe&q=paneer+pizza */
export const GET = route(async (request: Request) => {
  await requireUser();
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const source = params.get("source") as PhotoSource;
  const kind = params.get("kind") === "ingredient" ? "ingredient" : "recipe";

  if (!PHOTO_SOURCES.includes(source)) throw new ApiError(400, "Unknown photo source");
  if (!isSourceEnabled(source)) return json({ enabled: false, results: [] });
  if (!q) return json({ enabled: true, results: [] });

  try {
    return json({ enabled: true, results: await searchPhotos(source, q, kind) });
  } catch (err) {
    // One slow or broken source should not hide the others; the picker shows what came back.
    console.warn(`[rasoi] photo search (${source}) failed:`, err instanceof Error ? err.message : err);
    throw new ApiError(502, "This photo source did not answer");
  }
});
