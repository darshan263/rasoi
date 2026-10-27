import { prisma } from "@/lib/db";
import { IMAGE_ID } from "@/lib/image-format";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serve an uploaded photo. Deliberately not behind sign-in: an <img> in a native shell on
 * another origin cannot send the session. The 24-byte random id is what keeps it private, the
 * same way an unlisted photo link works. Photos never change once stored (a new photo gets a
 * new id), so they are cached for good.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!IMAGE_ID.test(id)) return new Response("Not found", { status: 404 });

  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
