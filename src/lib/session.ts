import "server-only";

import { cookies, headers } from "next/headers";
import type { User } from "@prisma/client";

import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./auth";

/**
 * The signed-in user for this request, re-read from the database so a changed password takes
 * effect at once.
 *
 * The token is taken from `Authorization: Bearer` first (a native shell on another origin),
 * then from the cookie (the web app). There is no middleware gate: every API route calls this
 * itself, which is also what lets the UI be exported as static files later.
 */
export async function getCurrentUser(): Promise<User | null> {
  const auth = (await headers()).get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  // A password change bumps tokenVersion, which retires every token signed before it.
  if (payload.ver !== user.tokenVersion) return null;
  return user;
}

/** Sets the cookie for the web app and returns the same token for a native shell. */
export async function startSession(user: User): Promise<string> {
  const token = await signSession({
    sub: user.id,
    name: user.email,
    email: user.email,
    ver: user.tokenVersion,
  });
  // HTTPS-only whenever the visit came over HTTPS (always, on Vercel). Keyed on the connection
  // rather than on NODE_ENV so a production build tried at home over plain http — a phone on
  // the Wi-Fi opening http://192.168.x.x — can still sign in instead of silently dropping the
  // cookie. Next sets x-forwarded-proto on every request; Vercel's proxy overwrites it.
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto ? proto === "https" : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return token;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** True before the first-run setup has been completed. */
export async function needsSetup(): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}
