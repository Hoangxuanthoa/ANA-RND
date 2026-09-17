import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function isEditable(me: { id: string; role: string }, collection: { createdById: string; status: string }) {
  if (me.role === "ADMIN") return true;
  return collection.status === "DRAFT" && collection.createdById === me.id;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; productCode: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, productCode } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEditable(me, collection)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.collectionItem.deleteMany({ where: { collectionId: id, productId: product.id } });
  return NextResponse.json({ ok: true });
}
