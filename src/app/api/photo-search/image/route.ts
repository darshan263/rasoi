import { ApiError, requireUser, route } from "@/lib/http";
import { sniffImage } from "@/lib/image-format";
import { downloadPhoto } from "@/lib/photo-search";

const MAX_DOWNLOAD = 10 * 1024 * 1024;

/**
 * GET /api/photo-search/image?url=… — fetch a photo picked in "Find online" so the browser can
 * resize it and upload it as the app's own copy (most photo hosts do not let a page read the
 * bytes of their images directly). Only the hosts in lib/photo-hosts.ts are fetched.
 */
export const GET = route(async (request: Request) => {
  await requireUser();
  const url = new URL(request.url).searchParams.get("url") ?? "";

  let photo;
  try {
    photo = await downloadPhoto(url, MAX_DOWNLOAD);
  } catch (err) {
    throw new ApiError(502, err instanceof Error ? err.message : "Could not download that photo");
  }

  const mime = sniffImage(photo.bytes);
  if (!mime) throw new ApiError(415, "That file is not a photo the app can use. Pick another.");

  return new Response(new Uint8Array(photo.bytes), {
    headers: { "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
});
