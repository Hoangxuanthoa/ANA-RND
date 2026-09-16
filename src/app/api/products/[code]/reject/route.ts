import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "Thiếu lý do từ chối." }, { status: 400 });

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: "DRAFT", lastRejectionReason: reason },
    include: productInclude(me.id),
  });
  return NextResponse.json(serializeProduct(updated));
}
