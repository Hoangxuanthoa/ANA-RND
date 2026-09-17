import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { collectionInclude, serializeCollection } from "@/lib/server/serialize-collection";

function isEditable(me: { id: string; role: string }, collection: { createdById: string; status: string }) {
  if (me.role === "ADMIN") return true;
  return collection.status === "DRAFT" && collection.createdById === me.id;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEditable(me, collection)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const productCode = typeof body.productCode === "string" ? body.productCode : "";
  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.collectionItem.upsert({
    where: { collectionId_productId: { collectionId: id, productId: product.id } },
    create: { collectionId: id, productId: product.id },
    update: {},
  });

  const updated = await prisma.collection.findUnique({ where: { id }, include: collectionInclude() });
  return NextResponse.json(serializeCollection(updated!));
}
