import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const favorited = body.favorited === true;

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (favorited) {
    await prisma.productFavorite.upsert({
      where: { userId_productId: { userId: me.id, productId: product.id } },
      create: { userId: me.id, productId: product.id },
      update: {},
    });
  } else {
    await prisma.productFavorite.deleteMany({ where: { userId: me.id, productId: product.id } });
  }

  const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude(me.id) });
  return NextResponse.json(serializeProduct(updated));
}
