import type { Prisma } from "@prisma/client";
import { formatDDMMYYYY } from "@/lib/mock-data";

export function collectionInclude() {
  return {
    createdBy: { select: { fullName: true } },
    project: { select: { projectCode: true } },
    items: { include: { product: { select: { productCode: true } } }, orderBy: { createdAt: "asc" as const } },
    pitches: { include: { loggedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" as const } },
  } satisfies Prisma.CollectionInclude;
}

type CollectionWithRelations = Prisma.CollectionGetPayload<{ include: ReturnType<typeof collectionInclude> }>;

export function serializeCollection(c: CollectionWithRelations) {
  return {
    id: c.id,
    name: c.name,
    createdByName: c.createdBy.fullName,
    createdAt: formatDDMMYYYY(c.createdAt),
    status: c.status,
    productCodes: c.items.map((i) => i.product.productCode),
    pitches: c.pitches.map((p) => ({
      customer: p.customerName,
      loggedByName: p.loggedBy.fullName,
      date: formatDDMMYYYY(p.createdAt),
      note: p.note ?? undefined,
    })),
    sourceProjectCode: c.project?.projectCode ?? undefined,
    publicSlug: c.publicSlug ?? undefined,
  };
}
