import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { ApiError, json, readJson, requireUser, route } from "@/lib/http";
import { passwordChangeInput } from "@/lib/schemas";
import { startSession } from "@/lib/session";

/** Change the password. Every other device is signed out; this one gets a fresh session. */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const { current, next } = await readJson(request, passwordChangeInput);

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    throw new ApiError(400, "The current password is not right");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10), tokenVersion: { increment: 1 } },
  });
  const token = await startSession(updated);
  return json({ ok: true, token });
});
