import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatDDMMYYYY } from "@/lib/mock-data";
import { nextVersionNumber } from "@/lib/server/product-codes";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const image = typeof body.image === "string" ? body.image : undefined;

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.role !== "ADMIN" && !(me.role === "RND" && product.designerId === me.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const versionNumber = await nextVersionNumber(product.id);
  const created = await prisma.$transaction(async (tx) => {
    const version = await tx.productVersion.create({
      data: { productId: product.id, versionNumber, note: note || null, imageUrl: image, uploadedById: me.id },
    });
    if (image) {
      await tx.productAsset.deleteMany({ where: { productId: product.id, assetType: "MAIN_RENDER" } });
      await tx.productAsset.create({
        data: { productId: product.id, assetType: "MAIN_RENDER", fileName: "main", fileUrl: image, uploadedById: me.id },
      });
    }
    return version;
  });

  return NextResponse.json({
    productCode: code,
    number: created.versionNumber,
    note: created.note ?? "",
    by: me.fullName,
    date: formatDDMMYYYY(created.createdAt),
    image: created.imageUrl ?? undefined,
  });
}
