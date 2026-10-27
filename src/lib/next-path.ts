/** Stands in for this site when resolving a path, so anything that escapes it is visible. */
const PROBE_ORIGIN = "http://same-site.invalid";

/**
 * Where to send someone after they sign in: a path on this site, or "/".
 *
 * Checking the string's prefix is not enough. Browsers and Next's own redirect resolve the
 * value as a URL, and the URL parser drops tabs and line breaks first, so `/<tab>/evil.com`
 * passes a `startsWith("//")` test and then lands on evil.com. So: refuse control characters
 * and backslashes outright, resolve the value the way a browser would, and keep it only if it
 * is still on this site. What comes back is the resolved path, never the raw input.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== PROBE_ORIGIN) return "/";
  return url.pathname + url.search + url.hash;
}
