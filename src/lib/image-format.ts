/** Largest upload accepted. The browser resizes before uploading, so real photos are far smaller. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * The image type from the file's own first bytes, or null if it is not one we serve. The
 * declared Content-Type is not trusted: whatever is stored is later served back with a type,
 * and serving uploaded bytes as something other than what they are is how an "image" becomes
 * a script.
 */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Upload ids: 24 random bytes as base64url, 32 characters. */
export const IMAGE_ID = /^[A-Za-z0-9_-]{32}$/;
export const UPLOADED_PREFIX = "/api/images/";

/** The upload id inside an image URL this app stored, or null for anything else. */
export function uploadedImageId(url: string | null | undefined): string | null {
  if (!url?.startsWith(UPLOADED_PREFIX)) return null;
  const id = url.slice(UPLOADED_PREFIX.length);
  return IMAGE_ID.test(id) ? id : null;
}

/** An image URL the app will store: one of its own uploads, or an https URL elsewhere. */
export function isAcceptableImageUrl(url: string): boolean {
  if (uploadedImageId(url)) return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
