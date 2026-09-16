import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";
import { nextProductCode } from "@/lib/server/product-codes";

// Full catalog, readable by any signed-in role — same trust model as
// GET /api/staff (every role needs it for cross-references; visibility
// within the UI is enforced by permissions.ts, not by hiding rows here).
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: productInclude(me.id),
  });
  return NextResponse.json(products.map(serializeProduct));
}

interface CreateBody {
  name?: string;
  category?: string;
  material?: string;
  color?: string;
  originCustomer?: string;
  mainImage?: string;
  images?: string[];
  sizeVariants?: { size: string; length?: number; width?: number; height?: number }[];
  autoSubmit?: boolean;
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "RND" && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: CreateBody = await request.json();
  const name = body.name?.trim();
  if (!name || !body.category || !body.material) {
    return NextResponse.json({ error: "Thiếu tên, category hoặc material." }, { status: 400 });
  }

  const [category, material, color, originCustomer] = await Promise.all([
    prisma.category.findFirst({ where: { name: body.category, isActive: true } }),
    prisma.material.findFirst({ where: { name: body.material, isActive: true } }),
    body.color ? prisma.color.findFirst({ where: { name: body.color, isActive: true } }) : null,
    body.originCustomer ? prisma.customer.findFirst({ where: { name: body.originCustomer } }) : null,
  ]);
  if (!category) return NextResponse.json({ error: "Category không hợp lệ." }, { status: 400 });
  if (!material) return NextResponse.json({ error: "Material không hợp lệ." }, { status: 400 });

  const sizeNames = [...new Set((body.sizeVariants ?? []).map((v) => v.size))];
  const sizeRows = sizeNames.length
    ? await prisma.size.findMany({ where: { name: { in: sizeNames }, isActive: true } })
    : [];
  const sizeIdByName = new Map(sizeRows.map((s) => [s.name, s.id]));
  const sizeVariantsCreate = (body.sizeVariants ?? [])
    .filter((v) => sizeIdByName.has(v.size))
    .map((v) => ({ sizeId: sizeIdByName.get(v.size)!, length: v.length, width: v.width, height: v.height }));

  const assetsCreate: { assetType: "MAIN_RENDER" | "RENDER"; fileName: string; fileUrl: string; uploadedById: string }[] = [];
  if (body.mainImage) {
    assetsCreate.push({ assetType: "MAIN_RENDER", fileName: "main", fileUrl: body.mainImage, uploadedById: me.id });
  }
  for (const url of body.images ?? []) {
    assetsCreate.push({ assetType: "RENDER", fileName: "render", fileUrl: url, uploadedById: me.id });
  }

  const autoSubmit = body.autoSubmit ?? false;
  const now = new Date();

  // Low-concurrency team, so scan-then-create is fine; retry once on the
  // rare chance two people create a product in the same instant and race
  // for the same generated code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const productCode = await nextProductCode();
    try {
      const created = await prisma.product.create({
        data: {
          productCode,
          name,
          categoryId: category.id,
          materialId: material.id,
          colorId: color?.id,
          designerId: me.id,
          originCustomerId: originCustomer?.id,
          status: autoSubmit ? "PENDING_REVIEW" : "DRAFT",
          submittedAt: autoSubmit ? now : undefined,
          sizeVariants: { create: sizeVariantsCreate },
          assets: { create: assetsCreate },
        },
        include: productInclude(me.id),
      });
      return NextResponse.json(serializeProduct(created));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "Không tạo được mã sản phẩm — thử lại." }, { status: 500 });
}
