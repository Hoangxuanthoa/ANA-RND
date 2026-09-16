import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectPhotoInclude, serializeProjectPhoto } from "@/lib/server/serialize-project-photo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const productCode = typeof body.productCode === "string" ? body.productCode : "";
  if (!productCode) return NextResponse.json({ error: "Thiếu productCode." }, { status: 400 });

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.projectPhoto.update({
    where: { id },
    data: { releasedProductId: product.id },
    include: projectPhotoInclude(),
  });
  return NextResponse.json(serializeProjectPhoto(updated));
}
