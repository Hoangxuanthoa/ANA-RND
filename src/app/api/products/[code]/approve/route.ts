import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";
import { notify } from "@/lib/server/notify";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: "RELEASED", lastRejectionReason: null },
    include: productInclude(me.id),
  });

  await notify({
    userId: product.designerId,
    type: "PRODUCT_APPROVED",
    title: `${updated.name} đã được duyệt`,
    message: "Sản phẩm đã Released vào Library.",
    link: `/library/${code}`,
  });

  return NextResponse.json(serializeProduct(updated));
}
