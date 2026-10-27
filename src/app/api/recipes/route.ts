import { json, readJson, requireUser, route } from "@/lib/http";
import { createRecipe, listRecipes } from "@/lib/recipes";
import { recipeInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/recipes?q=paneer&category=Pizza&components=only|exclude */
export const GET = route(async (request: Request) => {
  await requireUser();
  const params = new URL(request.url).searchParams;
  const components = params.get("components");
  const recipes = await listRecipes({
    q: params.get("q") ?? "",
    category: params.get("category") || undefined,
    components: components === "only" || components === "exclude" ? components : undefined,
  });
  return json({ recipes });
});

export const POST = route(async (request: Request) => {
  await requireUser();
  const input = await readJson(request, recipeInput);
  const id = await createRecipe(input);
  return json({ id }, 201);
});
