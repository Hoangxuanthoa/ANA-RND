import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// A NEW design uploaded straight into this project and never released
// only ever existed for this project — same "no activity elsewhere yet"
// situation as an unreleased ProjectPhoto, so deleting it here removes
// the product entirely (its Feedback rows too, since Product.feedback
// has no cascade). A REUSE pick, or a NEW item that's already RELEASED,
// is real shared library data — this only unlinks it from the project.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string; productCode: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role === "CUSTOMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code, productCode } = await params;
  const [project, product] = await Promise.all([
    prisma.project.findUnique({ where: { projectCode: code } }),
    prisma.product.findUnique({ where: { productCode } }),
  ]);
  if (!project || !product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.projectProduct.findUnique({
    where: { projectId_productId: { projectId: project.id, productId: product.id } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.usageType === "NEW" && product.status !== "RELEASED") {
    await prisma.$transaction([
      prisma.feedback.deleteMany({ where: { productId: product.id } }),
      prisma.projectProduct.delete({ where: { id: item.id } }),
      prisma.product.delete({ where: { id: product.id } }),
    ]);
  } else {
    await prisma.projectProduct.delete({ where: { id: item.id } });
  }

  return NextResponse.json({ ok: true });
}
