import bcrypt from "bcryptjs";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { ApiError, json, readJson, route } from "@/lib/http";
import { hit, reset } from "@/lib/rate-limit";
import { dbStore } from "@/lib/rate-limit-db";
import { credentialsInput } from "@/lib/schemas";
import { startSession } from "@/lib/session";

const MINUTES = 60 * 1000;

/**
 * Sign-in limits (the same scheme as FamilyFinance). A limit keyed on the email alone would let
 * anyone who knows the address lock the owner out, so where the client's address can be
 * trusted the tight limit is per email *and* address, with a looser per-address and a generous
 * per-email backstop.
 */
function throttles(email: string, address: string | null) {
  if (!address) return [{ key: `login:email:${email}`, limit: 10, windowMs: 15 * MINUTES }];
  return [
    { key: `login:pair:${email}|${address}`, limit: 10, windowMs: 15 * MINUTES },
    { key: `login:ip:${address}`, limit: 30, windowMs: 15 * MINUTES },
    { key: `login:email:${email}`, limit: 200, windowMs: 60 * MINUTES },
  ];
}

/** Only trusted when TRUST_PROXY_HEADER=true: without a proxy the header is whatever the client typed. */
async function clientAddress(): Promise<string | null> {
  if (process.env.TRUST_PROXY_HEADER !== "true") return null;
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export const POST = route(async (request: Request) => {
  const { email, password } = await readJson(request, credentialsInput);

  const limits = throttles(email, await clientAddress());
  for (const { key, limit, windowMs } of limits) {
    const check = await hit(dbStore, key, { limit, windowMs });
    if (!check.ok) {
      const mins = Math.ceil(check.retryAfter / 60);
      throw new ApiError(429, `Too many sign-in attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Hash even when the account is missing, so a wrong email and a wrong password take the same
  // time and the form cannot be used to discover the address.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) throw new ApiError(401, "Wrong email or password");

  for (const { key } of limits) await reset(dbStore, key);

  const token = await startSession(user);
  return json({ ok: true, token });
});
