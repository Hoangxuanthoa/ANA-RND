import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectProductInclude, serializeProjectProduct } from "@/lib/server/serialize-project";
import { notify } from "@/lib/server/notify";

// Unconditionally sends an item back to Developing from whichever
// review stage it was at, recording why.
export async function POST(request: Request, { params }: { params: Promise<{ code: string; productCode: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "Thiếu lý do." }, { status: 400 });

  const { code, productCode } = await params;
  const project = await prisma.project.findUnique({ where: { projectCode: code } });
  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!project || !product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.projectProduct.update({
    where: { projectId_productId: { projectId: project.id, productId: product.id } },
    data: { status: "DEVELOPING", customerApproval: "CHANGE_REQUESTED", lastRejectionReason: reason },
    include: { ...projectProductInclude(), project: { select: { projectCode: true } }, product: { select: { productCode: true } } },
  });

  if (updated.assigneeId) {
    await notify({
      userId: updated.assigneeId,
      type: "PROJECT_ITEM_CHANGE_REQUESTED",
      title: `${productCode} cần chỉnh sửa`,
      message: reason,
      link: `/projects/${code}`,
    });
  }

  return NextResponse.json(serializeProjectProduct(updated));
}
