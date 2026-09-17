import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectProductInclude, serializeProjectProduct } from "@/lib/server/serialize-project";
import { notify, notifyAllAdmins } from "@/lib/server/notify";

interface AddBody {
  productCode?: string;
  usage?: "NEW" | "REUSE";
  assigneeName?: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role === "CUSTOMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: AddBody = await request.json();
  if (!body.productCode || !body.usage) return NextResponse.json({ error: "Thiếu productCode/usage." }, { status: 400 });

  const { code } = await params;
  const [project, product, assignee] = await Promise.all([
    prisma.project.findUnique({ where: { projectCode: code } }),
    prisma.product.findUnique({ where: { productCode: body.productCode } }),
    body.assigneeName ? prisma.user.findFirst({ where: { fullName: body.assigneeName } }) : null,
  ]);
  if (!project || !product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.projectProduct.findUnique({
    where: { projectId_productId: { projectId: project.id, productId: product.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Sản phẩm đã có trong dự án." }, { status: 400 });
  }

  const [created] = await prisma.$transaction([
    prisma.projectProduct.create({
      data: {
        projectId: project.id,
        productId: product.id,
        usageType: body.usage,
        status: "SALES_REVIEW",
        customerApproval: "PENDING",
        addedById: me.id,
        assigneeId: assignee?.id,
      },
      include: { ...projectProductInclude(), project: { select: { projectCode: true } }, product: { select: { productCode: true } } },
    }),
    ...(project.status === "CREATED" ? [prisma.project.update({ where: { id: project.id }, data: { status: "DEVELOPING" } })] : []),
  ]);

  if (project.createdById !== me.id) {
    await notify({
      userId: project.createdById,
      type: "PROJECT_ITEM_NEEDS_REVIEW",
      title: "Có sản phẩm mới cần bạn duyệt",
      message: `${body.productCode} trong dự án ${project.projectName}`,
      link: `/projects/${code}?product=${body.productCode}`,
    });
  }

  // Admin team-wide awareness of every product added to any project —
  // exclude whoever added it (no self-notify) and the project's own
  // creator (already covered by the more specific notice just above).
  await notifyAllAdmins(
    {
      type: "PROJECT_PRODUCT_ADDED",
      title: "Sản phẩm mới được thêm vào dự án",
      message: `${body.productCode} vừa được thêm vào dự án ${project.projectName}.`,
      link: `/projects/${code}?product=${body.productCode}`,
    },
    [me.id, project.createdById],
  );

  return NextResponse.json(serializeProjectProduct(created));
}
