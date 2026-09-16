import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tintFor } from "@/lib/server/serialize-product";

// No getSessionUser() check here on purpose — this is the one deliberately
// public data route in the app (see src/lib/supabase/middleware.ts, which
// also lets this exact path through before the session check runs). Keyed
// by the unguessable publicSlug, never the internal collection id, and
// only ever returns the safe customer-facing subset of a product (no
// designer/status/exclusivity/etc.).
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const collection = await prisma.collection.findUnique({
    where: { publicSlug: slug },
    select: {
      name: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          product: {
            select: {
              productCode: true,
              category: { select: { name: true } },
              material: { select: { name: true } },
              assets: { where: { assetType: "MAIN_RENDER" }, select: { fileUrl: true }, take: 1 },
              sizeVariants: { include: { size: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: collection.name,
    items: collection.items.map(({ product }) => ({
      code: product.productCode,
      category: product.category.name,
      material: product.material.name,
      mainImage: product.assets[0]?.fileUrl,
      tint: tintFor(product.category.name),
      sizeVariants: product.sizeVariants.map((v) => ({
        size: v.size.name,
        length: v.length ?? undefined,
        width: v.width ?? undefined,
        height: v.height ?? undefined,
      })),
    })),
  });
}
