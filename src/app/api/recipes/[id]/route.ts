import { ApiError, json, readJson, requireUser, route } from "@/lib/http";
import { deleteRecipe, loadRecipe, updateRecipe } from "@/lib/recipes";
import { recipeInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Ctx) => {
  await requireUser();
  const recipe = await loadRecipe((await params).id);
  if (!recipe) throw new ApiError(404, "That recipe no longer exists");
  return json(recipe);
});

export const PUT = route(async (request: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  await updateRecipe(id, await readJson(request, recipeInput));
  return json({ id });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  await requireUser();
  await deleteRecipe((await params).id);
  return json({ ok: true });
});
