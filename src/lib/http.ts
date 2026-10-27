import "server-only";

import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import type { ZodTypeAny, output } from "zod";

import { getCurrentUser } from "./session";

/** An error the person can act on. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Wrap a route handler: turns ApiError into a JSON error with its status, and anything else
 * into a logged 500 that does not leak internals.
 */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status);
      console.error("[rasoi] request failed:", err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "You are signed out. Sign in again.");
  return user;
}

/**
 * Read and validate a JSON body. Requiring the JSON content type is also the CSRF guard for
 * cookie-authenticated requests: a cross-site form can only send form or plain-text bodies,
 * and a cross-site script cannot send JSON without a CORS preflight this app never approves.
 */
export async function readJson<S extends ZodTypeAny>(request: Request, schema: S): Promise<output<S>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Expected a JSON body");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "That request was not valid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue?.message ?? "Check the details");
  }
  return parsed.data;
}
