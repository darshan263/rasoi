import { prisma } from "@/lib/db";
import { ApiError, json, readJson, requireUser, route } from "@/lib/http";
import { releaseImage } from "@/lib/images";
import { toIngredientDto } from "@/lib/ingredients";
import { ingredientPatch } from "@/lib/schemas";
import { nameKey } from "@/lib/text";
import type { IngredientDetailDto } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function recipesUsing(id: string) {
  const rows = await prisma.recipe.findMany({
    where: { sections: { some: { items: { some: { ingredientId: id } } } } },
    select: { id: true, name: true },
    orderBy: { nameKey: "asc" },
  });
  return rows;
}

export const GET = route(async (_request: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) throw new ApiError(404, "That ingredient is no longer in the library");
  const body: IngredientDetailDto = { ...toIngredientDto(ingredient), usedIn: await recipesUsing(id) };
  return json(body);
});

export const PATCH = route(async (request: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const input = await readJson(request, ingredientPatch);

  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "That ingredient is no longer in the library");

  const data: Record<string, unknown> = { ...input };
  if (input.name !== undefined) {
    const key = nameKey(input.name);
    const clash = await prisma.ingredient.findUnique({ where: { nameKey: key } });
    if (clash && clash.id !== id) throw new ApiError(409, `"${clash.name}" is already in the library`);
    data.nameKey = key;
  }

  const updated = await prisma.ingredient.update({ where: { id }, data });
  if (input.imageUrl !== undefined && existing.imageUrl !== updated.imageUrl) {
    await releaseImage(existing.imageUrl);
  }
  return json(toIngredientDto(updated));
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "That ingredient is no longer in the library");

  const used = await recipesUsing(id);
  if (used.length > 0) {
    throw new ApiError(409, `Used in ${used.map((r) => r.name).join(", ")}. Remove it from those recipes first.`);
  }
  await prisma.ingredient.delete({ where: { id } });
  await releaseImage(existing.imageUrl);
  return json({ ok: true });
});
