"use client";

/**
 * The one way the UI talks to the server.
 *
 * On the web the API is on the same origin and the session is a cookie. Inside a native shell
 * (Tauri/Capacitor) the UI is local files, so NEXT_PUBLIC_API_BASE points at the deployed site
 * and the session token is sent as a Bearer header instead.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
const TOKEN_KEY = "rasoi_token";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function storedToken(): string | null {
  if (!API_BASE) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Keep the token a sign-in returned, when the cookie cannot carry it (native shell only). */
export function rememberToken(token: string | undefined): void {
  if (!API_BASE || !token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode: the session lasts as long as the page.
  }
}

export function forgetToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** Where an image URL actually lives: uploads are served by the API. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? API_BASE + url : url;
}

export async function api<T>(
  path: string,
  { method = "GET", body, raw }: { method?: string; body?: unknown; raw?: Blob } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = storedToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (raw) {
    headers["Content-Type"] = raw.type;
    payload = raw;
  } else if (body !== undefined || method !== "GET") {
    headers["Content-Type"] = "application/json";
    payload = body === undefined ? "{}" : JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: method === "GET" ? undefined : payload,
      credentials: API_BASE ? "omit" : "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(0, "Could not reach the server. Check your connection.");
  }

  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      const back = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(back)}`;
    }
    throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/** GET binary data (a photo) from the API, with the same sign-in handling as `api`. */
export async function apiBlob(path: string): Promise<Blob> {
  const token = storedToken();
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: API_BASE ? "omit" : "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(0, "Could not reach the server. Check your connection.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return res.blob();
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}
