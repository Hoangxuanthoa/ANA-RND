import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";
import { nextProductCodes } from "@/lib/server/product-codes";

interface BulkBody {
  images?: { name: string; mainImage: string }[];
  originCustomer?: string;
}

// One placeholder product per image — `incomplete: true` so it can move
// through review but can't be Released until someone fills in the real
// name/category/material (isProjectProductReadyToRelease). Defaults to
// whatever category/material/color happens to sort first, same as the
// mock version.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "RND" && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: BulkBody = await request.json();
  const images = body.images ?? [];
  if (images.length === 0) return NextResponse.json({ error: "Thiếu ảnh." }, { status: 400 });

  const [category, material, color, originCustomer] = await Promise.all([
    prisma.category.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.material.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.color.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }),
    body.originCustomer ? prisma.customer.findFirst({ where: { name: body.originCustomer } }) : null,
  ]);
  if (!category || !material) {
    return NextResponse.json({ error: "Chưa có Category/Material nào — vào Cài đặt tạo trước." }, { status: 400 });
  }

  const codes = await nextProductCodes(images.length);
  const created = await prisma.$transaction(
    images.map((img, i) =>
      prisma.product.create({
        data: {
          productCode: codes[i],
          name: img.name,
          categoryId: category.id,
          materialId: material.id,
          colorId: color?.id,
          designerId: me.id,
          originCustomerId: originCustomer?.id,
          status: "DRAFT",
          incomplete: true,
          assets: { create: [{ assetType: "MAIN_RENDER", fileName: "main", fileUrl: img.mainImage, uploadedById: me.id }] },
        },
        include: productInclude(me.id),
      }),
    ),
  );
  return NextResponse.json(created.map(serializeProduct));
}
