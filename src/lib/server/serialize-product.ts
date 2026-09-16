import type { Prisma } from "@prisma/client";
import { formatDDMMYYYY } from "@/lib/mock-data";

// One shared include shape + serializer so GET (list/one) and the
// mutation routes that return the updated row all produce the exact
// same JSON shape ProductsProvider's adapter expects. `favorites` is
// filtered to just this viewer's row (0 or 1) to answer "did I favorite
// this", alongside `_count.favorites` for the total.
export function productInclude(userId: string) {
  return {
    category: { select: { name: true } },
    material: { select: { name: true } },
    color: { select: { name: true } },
    designer: { select: { fullName: true } },
    exclusiveBy: { select: { fullName: true } },
    originCustomer: { select: { name: true } },
    sizeVariants: { include: { size: { select: { name: true } } } },
    assets: { orderBy: { createdAt: "desc" as const } },
    favorites: { where: { userId }, select: { id: true } },
    _count: { select: { favorites: true } },
  } satisfies Prisma.ProductInclude;
}

type ProductWithRelations = Prisma.ProductGetPayload<{ include: ReturnType<typeof productInclude> }>;

const TINTS = ["accent", "blue", "green", "slate"] as const;

// Deterministic, not stored — the mock Product.tint field never carried
// real meaning beyond "a stable color per card", so a hash of the
// category name reproduces that without a schema column.
function tintFor(category: string): (typeof TINTS)[number] {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function serializeProduct(p: ProductWithRelations) {
  const mainAsset = p.assets.find((a) => a.assetType === "MAIN_RENDER");
  const otherAssets = p.assets.filter((a) => a.assetType !== "MAIN_RENDER");
  return {
    code: p.productCode,
    name: p.name,
    category: p.category.name,
    material: p.material.name,
    color: p.color?.name,
    designer: p.designer.fullName,
    exclusiveBy: p.exclusiveBy?.fullName,
    originCustomer: p.originCustomer?.name ?? "—",
    description: p.description ?? undefined,
    status: p.status,
    reuse: p.reusePermission,
    sourceProjectName: p.sourceProjectName ?? undefined,
    submittedAt: p.submittedAt ? formatDDMMYYYY(p.submittedAt) : undefined,
    lastRejectionReason: p.lastRejectionReason ?? undefined,
    incomplete: p.incomplete,
    createdAt: formatDDMMYYYY(p.createdAt),
    favorites: p._count.favorites,
    favoritedByMe: p.favorites.length > 0,
    tint: tintFor(p.category.name),
    mainImage: mainAsset?.fileUrl,
    images: otherAssets.map((a) => a.fileUrl),
    sizeVariants: p.sizeVariants.map((v) => ({
      size: v.size.name,
      length: v.length ?? undefined,
      width: v.width ?? undefined,
      height: v.height ?? undefined,
    })),
  };
}
