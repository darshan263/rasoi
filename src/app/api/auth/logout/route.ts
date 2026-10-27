import { json, route } from "@/lib/http";
import { endSession } from "@/lib/session";

export const POST = route(async () => {
  await endSession();
  return json({ ok: true });
});
