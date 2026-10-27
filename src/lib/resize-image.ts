"use client";

/**
 * Shrink a photo in the browser before it is uploaded: a 12-megapixel phone photo is 4-8 MB,
 * and the longest side needed for a recipe cover is ~1280px. Re-encoding also strips EXIF
 * (including GPS location) from camera photos. WebP where the browser can encode it, else JPEG.
 */
export async function resizeImage(file: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process photos");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();

  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Could not process that photo");
  return jpeg;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** createImageBitmap honours EXIF rotation; the <img> fallback covers older Safari. */
async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("That file is not a photo this browser can open");
  } finally {
    URL.revokeObjectURL(url);
  }
}
