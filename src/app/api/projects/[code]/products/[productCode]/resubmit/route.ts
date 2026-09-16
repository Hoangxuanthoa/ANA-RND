import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectProductInclude, serializeProjectProduct } from "@/lib/server/serialize-project";

// Puts a Developing (rejected) item back at the very first review
// stage — always the creator's, even if it was a Customer rejection.
// No notification (matches the mock — resubmit is silent).
export async function POST(_request: Request, { params }: { params: Promise<{ code: string; productCode: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, productCode } = await params;
  const project = await prisma.project.findUnique({ where: { projectCode: code } });
  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!project || !product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.projectProduct.update({
    where: { projectId_productId: { projectId: project.id, productId: product.id } },
    data: { status: "SALES_REVIEW", customerApproval: "PENDING", lastRejectionReason: null },
    include: { ...projectProductInclude(), project: { select: { projectCode: true } }, product: { select: { productCode: true } } },
  });
  return NextResponse.json(serializeProjectProduct(updated));
}
