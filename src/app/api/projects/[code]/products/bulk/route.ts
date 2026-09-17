import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectProductInclude, serializeProjectProduct } from "@/lib/server/serialize-project";
import { notify, notifyAllAdmins } from "@/lib/server/notify";

interface BulkBody {
  productCodes?: string[];
  usage?: "NEW" | "REUSE";
  assigneeName?: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role === "CUSTOMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: BulkBody = await request.json();
  const productCodes = body.productCodes ?? [];
  if (productCodes.length === 0 || !body.usage) return NextResponse.json({ error: "Thiếu productCodes/usage." }, { status: 400 });

  const { code } = await params;
  const [project, products, assignee, existingRows] = await Promise.all([
    prisma.project.findUnique({ where: { projectCode: code } }),
    prisma.product.findMany({ where: { productCode: { in: productCodes } } }),
    body.assigneeName ? prisma.user.findFirst({ where: { fullName: body.assigneeName } }) : null,
    prisma.projectProduct.findMany({ where: { project: { projectCode: code } }, select: { productId: true } }),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existingProductIds = new Set(existingRows.map((r) => r.productId));
  const toCreate = products.filter((p) => !existingProductIds.has(p.id));

  await prisma.$transaction([
    ...toCreate.map((product) =>
      prisma.projectProduct.create({
        data: {
          projectId: project.id,
          productId: product.id,
          usageType: body.usage!,
          status: "SALES_REVIEW",
          customerApproval: "PENDING",
          addedById: me.id,
          assigneeId: assignee?.id,
        },
      }),
    ),
    ...(project.status === "CREATED" ? [prisma.project.update({ where: { id: project.id }, data: { status: "DEVELOPING" } })] : []),
  ]);

  if (toCreate.length > 0) {
    if (project.createdById !== me.id) {
      await notify({
        userId: project.createdById,
        type: "PROJECT_ITEM_NEEDS_REVIEW",
        title: "Có sản phẩm mới cần bạn duyệt",
        message: `${toCreate.length} sản phẩm mới trong dự án ${project.projectName}`,
        link: `/projects/${code}`,
      });
    }
    // Admin team-wide awareness — one shared notice for the whole batch
    // (not one per product), landing on the project page since there's
    // no single specific product to deep-link to for a batch.
    await notifyAllAdmins(
      {
        type: "PROJECT_PRODUCT_ADDED",
        title: "Sản phẩm mới được thêm vào dự án",
        message: `${toCreate.length} sản phẩm mới vừa được thêm vào dự án ${project.projectName}.`,
        link: `/projects/${code}`,
      },
      [me.id, project.createdById],
    );
  }

  const created = await prisma.projectProduct.findMany({
    where: { projectId: project.id, productId: { in: toCreate.map((p) => p.id) } },
    include: { ...projectProductInclude(), project: { select: { projectCode: true } }, product: { select: { productCode: true } } },
  });
  return NextResponse.json(created.map(serializeProjectProduct));
}
