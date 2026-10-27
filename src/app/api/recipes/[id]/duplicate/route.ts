import { ApiError, json, requireUser, route } from "@/lib/http";
import { duplicateRecipe } from "@/lib/recipes";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, { params }: Ctx) => {
  await requireUser();
  // No body to read, so require the JSON header explicitly: it is what a cross-site form
  // cannot send (see readJson).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new ApiError(415, "Expected a JSON request");
  }
  const id = await duplicateRecipe((await params).id);
  return json({ id }, 201);
});
