import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";

// Path A: a standalone (no project) draft submitted straight to the
// Admin review queue.
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.role !== "ADMIN" && !(me.role === "RND" && product.designerId === me.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: "PENDING_REVIEW", submittedAt: new Date(), sourceProjectName: null },
    include: productInclude(me.id),
  });
  return NextResponse.json(serializeProduct(updated));
}
