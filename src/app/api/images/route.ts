import { ApiError, json, requireUser, route } from "@/lib/http";
import { MAX_IMAGE_BYTES } from "@/lib/image-format";
import { storeImage } from "@/lib/images";

/**
 * Upload a photo as the raw request body (Content-Type image/jpeg, image/png or image/webp).
 * Returns `{ url }` to put on a recipe or ingredient. The browser resizes photos first.
 *
 * Requiring an image content type is also the CSRF guard here: a cross-site form cannot send one.
 */
export const POST = route(async (request: Request) => {
  await requireUser();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("image/")) {
    throw new ApiError(415, "Upload a photo");
  }
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_IMAGE_BYTES) throw new ApiError(413, "That photo is too large (2 MB at most)");

  const bytes = new Uint8Array(await request.arrayBuffer());
  const url = await storeImage(bytes);
  return json({ url }, 201);
});
