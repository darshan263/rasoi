import { SignJWT, jwtVerify } from "jose";

/**
 * Signing and verifying the session token. Free of Prisma and bcrypt, so it can run anywhere.
 * The same token travels as a cookie (the web app) or an `Authorization: Bearer` header (a
 * native shell such as Tauri, which runs on another origin and cannot share the cookie).
 */

export const SESSION_COOKIE = "rasoi_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  sub: string;
  name: string;
  email: string;
  /** User.tokenVersion at signing time. A mismatch retires the session. */
  ver: number;
}

/** The shortest AUTH_SECRET accepted. `npm run check:env` holds deployments to the same. */
export const MIN_SECRET_LENGTH = 32;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a long random string in .env before signing in.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, email: payload.email, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  // Deliberately outside the try. A missing or too-short AUTH_SECRET is a configuration
  // fault, not a bad token, and `secretKey()` throws a message saying exactly what to do.
  // Catching it here would turn the likeliest production misconfiguration into an endless
  // silent bounce back to /login with nothing anywhere explaining why.
  const key = secretKey();

  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      ver: Number(payload.ver ?? 0),
    };
  } catch {
    return null;
  }
}
