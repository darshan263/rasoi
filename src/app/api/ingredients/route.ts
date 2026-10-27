import { prisma } from "@/lib/db";
import { ApiError, json, readJson, requireUser, route } from "@/lib/http";
import { isIngredientCategory } from "@/lib/categories";
import { searchIngredients, toIngredientDto } from "@/lib/ingredients";
import { ingredientInput } from "@/lib/schemas";
import { nameKey } from "@/lib/text";

export const dynamic = "force-dynamic";

/** GET /api/ingredients?q=tom&category=vegetables&limit=40&offset=0 */
export const GET = route(async (request: Request) => {
  await requireUser();
  const params = new URL(request.url).searchParams;
  const category = params.get("category") ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 40, 1), 200);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  const result = await searchIngredients({
    q: params.get("q") ?? "",
    category: isIngredientCategory(category) ? category : undefined,
    limit,
    offset,
  });
  return json(result);
});

export const POST = route(async (request: Request) => {
  await requireUser();
  const input = await readJson(request, ingredientInput);
  const key = nameKey(input.name);

  const existing = await prisma.ingredient.findUnique({ where: { nameKey: key } });
  if (existing) throw new ApiError(409, `"${existing.name}" is already in the library`);

  const created = await prisma.ingredient.create({ data: { ...input, nameKey: key } });
  return json(toIngredientDto(created), 201);
});
