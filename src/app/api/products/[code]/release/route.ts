import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";

// Path B: R&D releases a design out of a (closed) project into the
// general library — also lands in the same review queue as submit.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  if (!projectName) return NextResponse.json({ error: "Thiếu tên dự án." }, { status: 400 });

  const { code } = await params;
  const product = await prisma.product.findUnique({ where: { productCode: code } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.role !== "ADMIN" && !(me.role === "RND" && product.designerId === me.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: "PENDING_REVIEW", submittedAt: new Date(), sourceProjectName: projectName },
    include: productInclude(me.id),
  });
  return NextResponse.json(serializeProduct(updated));
}
