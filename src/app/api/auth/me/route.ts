import { json, route } from "@/lib/http";
import { getCurrentUser, needsSetup } from "@/lib/session";
import type { MeDto } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Who is signed in, if anyone, and whether first-run setup is still to do. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  const body: MeDto = {
    user: user ? { email: user.email } : null,
    needsSetup: user ? false : await needsSetup(),
  };
  return json(body);
});
