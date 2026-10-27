import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "./db";
import { MAX_IMAGE_BYTES, UPLOADED_PREFIX, sniffImage, uploadedImageId } from "./image-format";
import { ApiError } from "./http";

export async function storeImage(bytes: Uint8Array): Promise<string> {
  if (bytes.length === 0) throw new ApiError(400, "The photo was empty");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ApiError(413, "That photo is too large (2 MB at most)");
  const mime = sniffImage(bytes);
  if (!mime) throw new ApiError(415, "Use a JPEG, PNG or WebP photo");

  const id = randomBytes(24).toString("base64url");
  await prisma.image.create({ data: { id, mime, data: Buffer.from(bytes) } });
  return UPLOADED_PREFIX + id;
}

/**
 * Delete an uploaded photo once nothing points at it any more. Called after a recipe or
 * ingredient changes or drops its photo. A duplicated recipe shares its original's photo, so
 * the reference count is what decides, not the one row that let go of it. External (seeded)
 * image URLs are left alone.
 *
 * Best-effort: a photo left behind costs a little space and nothing else, so a failure here
 * must not fail the save that triggered it.
 */
export async function releaseImage(url: string | null | undefined): Promise<void> {
  const id = uploadedImageId(url);
  if (!id) return;
  try {
    const [recipes, ingredients] = await Promise.all([
      prisma.recipe.count({ where: { imageUrl: url! } }),
      prisma.ingredient.count({ where: { imageUrl: url! } }),
    ]);
    if (recipes + ingredients === 0) await prisma.image.deleteMany({ where: { id } });
  } catch (err) {
    console.error("[rasoi] could not release image", id, err);
  }
}
