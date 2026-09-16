import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productInclude, serializeProduct } from "@/lib/server/serialize-product";

async function findByCode(code: string) {
  return prisma.product.findUnique({ where: { productCode: code } });
}

// ADMIN can edit anything; RND can only edit their own design — mirrors
// canEditProduct(role, userName, product) in lib/permissions.ts, just
// checked against the real designerId instead of a name string.
function canEdit(me: { id: string; role: string }, product: { designerId: string }) {
  return me.role === "ADMIN" || (me.role === "RND" && product.designerId === me.id);
}

interface PatchBody {
  name?: string | null;
  category?: string | null;
  material?: string | null;
  color?: string | null;
  description?: string | null;
  mainImage?: string | null;
  images?: string[] | null;
  sizeVariants?: { size: string; length?: number; width?: number; height?: number }[] | null;
  incomplete?: boolean;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const product = await findByCode(code);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(me, product)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: PatchBody = await request.json();
  const data: Record<string, unknown> = {};

  if ("name" in body && body.name) data.name = body.name.trim();
  if ("description" in body) data.description = body.description ?? null;
  if ("incomplete" in body) data.incomplete = body.incomplete;

  if ("category" in body && body.category) {
    const category = await prisma.category.findFirst({ where: { name: body.category, isActive: true } });
    if (!category) return NextResponse.json({ error: "Category không hợp lệ." }, { status: 400 });
    data.categoryId = category.id;
  }
  if ("material" in body && body.material) {
    const material = await prisma.material.findFirst({ where: { name: body.material, isActive: true } });
    if (!material) return NextResponse.json({ error: "Material không hợp lệ." }, { status: 400 });
    data.materialId = material.id;
  }
  if ("color" in body) {
    const color = body.color ? await prisma.color.findFirst({ where: { name: body.color, isActive: true } }) : null;
    data.colorId = color?.id ?? null;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.product.update({ where: { id: product.id }, data });
    }

    if ("sizeVariants" in body) {
      const variants = body.sizeVariants ?? [];
      const sizeNames = [...new Set(variants.map((v) => v.size))];
      const sizeRows = sizeNames.length
        ? await tx.size.findMany({ where: { name: { in: sizeNames }, isActive: true } })
        : [];
      const sizeIdByName = new Map(sizeRows.map((s) => [s.name, s.id]));
      await tx.productSizeVariant.deleteMany({ where: { productId: product.id } });
      const toCreate = variants
        .filter((v) => sizeIdByName.has(v.size))
        .map((v) => ({ productId: product.id, sizeId: sizeIdByName.get(v.size)!, length: v.length, width: v.width, height: v.height }));
      if (toCreate.length > 0) await tx.productSizeVariant.createMany({ data: toCreate });
    }

    if ("mainImage" in body) {
      await tx.productAsset.deleteMany({ where: { productId: product.id, assetType: "MAIN_RENDER" } });
      if (body.mainImage) {
        await tx.productAsset.create({
          data: { productId: product.id, assetType: "MAIN_RENDER", fileName: "main", fileUrl: body.mainImage, uploadedById: me.id },
        });
      }
    }
    if ("images" in body) {
      await tx.productAsset.deleteMany({ where: { productId: product.id, assetType: "RENDER" } });
      const urls = body.images ?? [];
      if (urls.length > 0) {
        await tx.productAsset.createMany({
          data: urls.map((url) => ({ productId: product.id, assetType: "RENDER" as const, fileName: "render", fileUrl: url, uploadedById: me.id })),
        });
      }
    }
  });

  const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude(me.id) });
  return NextResponse.json(serializeProduct(updated));
}

// Irreversible, so re-verify the DRAFT + no-usage rule server-side too
// (canHardDeleteProduct), not just the role check — every other mutation
// here is a reversible status/field flip and doesn't need this extra
// defense.
export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: { _count: { select: { projectProducts: true } } },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(me, product)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (product.status !== "DRAFT" || product._count.projectProducts > 0) {
    return NextResponse.json({ error: "Sản phẩm đã có hoạt động, không thể xóa hẳn." }, { status: 400 });
  }

  await prisma.product.delete({ where: { id: product.id } });
  return NextResponse.json({ ok: true });
}
