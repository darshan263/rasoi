import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { ApiError, json, readJson, route } from "@/lib/http";
import { seedIngredientRows } from "@/lib/ingredients";
import { setupInput } from "@/lib/schemas";
import { needsSetup, startSession } from "@/lib/session";

class AlreadySetUp extends Error {}

/** First run: create the one login and fill the ingredient library. */
export const POST = route(async (request: Request) => {
  if (!(await needsSetup())) throw new ApiError(409, "This has already been set up. Sign in instead.");
  const { email, password } = await readJson(request, setupInput);
  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.$transaction(
      async (tx) => {
        // Re-check inside the transaction for a second submission that arrives after the
        // first committed. Two truly simultaneous ones are stopped by the unique ingredient
        // names failing the second insert.
        if ((await tx.user.count()) > 0) throw new AlreadySetUp();
        const created = await tx.user.create({ data: { email, passwordHash } });
        await tx.ingredient.createMany({ data: seedIngredientRows() });
        return created;
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    const duplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (err instanceof AlreadySetUp || duplicate) {
      throw new ApiError(409, "This has already been set up. Sign in instead.");
    }
    throw err;
  }

  const token = await startSession(user);
  return json({ ok: true, token });
});
