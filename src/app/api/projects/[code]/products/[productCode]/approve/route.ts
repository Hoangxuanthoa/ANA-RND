import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectProductInclude, serializeProjectProduct } from "@/lib/server/serialize-project";
import { notify } from "@/lib/server/notify";

// Advances one item through its project's internal review: from the
// creator's own review to either Customer review (creator is Sales) or
// straight to Approved (creator is Admin/Marketing, no real customer to
// ask), or from Customer review to Approved. Auto-completes the project
// once every one of its items is Approved. Exact port of
// approveProjectProduct in the old mock ProjectsProvider.
export async function POST(_request: Request, { params }: { params: Promise<{ code: string; productCode: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, productCode } = await params;
  const project = await prisma.project.findUnique({
    where: { projectCode: code },
    include: { createdBy: { select: { role: true } }, customer: { select: { id: true } } },
  });
  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!project || !product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = await prisma.projectProduct.findUnique({
    where: { projectId_productId: { projectId: project.id, productId: product.id } },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const creatorRole = project.createdBy.role;
  let nextStatus = current.status;
  let nextApproval = current.customerApproval;
  if (current.status === "SALES_REVIEW") {
    nextStatus = creatorRole === "SALES" ? "CUSTOMER_REVIEW" : "APPROVED";
    nextApproval = nextStatus === "APPROVED" ? "APPROVED" : "PENDING";
  } else if (current.status === "CUSTOMER_REVIEW") {
    nextStatus = "APPROVED";
    nextApproval = "APPROVED";
  }

  const updated = await prisma.projectProduct.update({
    where: { id: current.id },
    data: { status: nextStatus, customerApproval: nextApproval },
    include: { ...projectProductInclude(), project: { select: { projectCode: true } }, product: { select: { productCode: true } } },
  });

  if (current.status === "SALES_REVIEW" && creatorRole === "SALES" && project.customerId) {
    // Moved on to the real Customer review stage — find whichever real
    // account(s) belong to this customer and notify them it's their turn.
    const customerUsers = await prisma.user.findMany({ where: { customerId: project.customerId } });
    for (const u of customerUsers) {
      await notify({
        userId: u.id,
        type: "PROJECT_ITEM_NEEDS_REVIEW",
        title: "Có mẫu mới cần bạn duyệt",
        message: `${productCode} trong dự án ${project.projectName}`,
        link: `/projects/${code}?product=${productCode}`,
      });
    }
  } else if (current.assigneeId) {
    await notify({
      userId: current.assigneeId,
      type: "PROJECT_ITEM_APPROVED",
      title: "Sản phẩm của bạn đã được duyệt",
      message: `${productCode} trong dự án ${project.projectName} đã Approved.`,
      link: `/projects/${code}?product=${productCode}`,
    });
  }

  // Auto-complete the moment every item in the project is Approved.
  if (project.status === "DEVELOPING") {
    const items = await prisma.projectProduct.findMany({ where: { projectId: project.id } });
    if (items.length > 0 && items.every((i) => i.status === "APPROVED")) {
      await prisma.project.update({ where: { id: project.id }, data: { status: "COMPLETED" } });
    }
  }

  return NextResponse.json(serializeProjectProduct(updated));
}
