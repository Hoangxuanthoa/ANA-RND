import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";

// Only Sales (or Admin) marks a design Exclusive — matches canSetExclusive
// in lib/permissions.ts. No id/name for "who" is ever sent from the
// client: exclusiveById is always stamped as the caller's own id.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "SALES" && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const reuse = body.reuse === "EXCLUSIVE" ? "EXCLUSIVE" : "REUSABLE";

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { reusePermission: reuse, exclusiveById: reuse === "EXCLUSIVE" ? me.id : null },
    include: productInclude(me.id),
  });
  return NextResponse.json(serializeProduct(updated));
}
