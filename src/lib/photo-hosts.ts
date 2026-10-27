/**
 * Where "Find online" may download a photo from. The server fetches the picked photo on the
 * browser's behalf (most of these hosts do not allow the browser to read the bytes itself), so
 * without this list the endpoint would fetch any URL it was handed, including addresses inside
 * the server's own network.
 */
export const PHOTO_HOSTS = [
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
  "www.themealdb.com",
  "api.openverse.org",
  "images.pexels.com",
];

export function isAllowedPhotoUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && !url.username && !url.password && url.port === "" && PHOTO_HOSTS.includes(url.hostname);
}

export const PHOTO_SOURCES = ["mealdb", "pexels", "wikimedia", "openverse"] as const;
export type PhotoSource = (typeof PHOTO_SOURCES)[number];

export const PHOTO_SOURCE_LABELS: Record<PhotoSource, string> = {
  mealdb: "TheMealDB",
  pexels: "Pexels",
  wikimedia: "Wikimedia Commons",
  openverse: "Openverse",
};

export interface PhotoResult {
  /** Small image for the picker grid. */
  thumb: string;
  /** The size to download when picked (always on an allowed host). */
  full: string;
  source: PhotoSource;
  title: string;
  /** Who made it, and the licence, where the source says. */
  credit: string | null;
}
