import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { getBreakdownAccess, type BreakdownAccess } from "@/lib/server/breakdown-access";

// "Nhân bản": an independent copy of a breakdown (every product's full data,
// drawing sessions included) owned by whoever clicked — e.g. the same products
// in another colour. Anyone who can open the source may copy it; the copy is
// the copier's own, so it's editable by them and not shared with anyone.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const src = await prisma.breakdown.findUnique({ where: { id }, include: { products: { orderBy: { sortOrder: "asc" } } } });
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.breakdown.create({
    data: {
      name: `${src.name} (bản sao)`,
      createdById: me.id,
      products: {
        create: src.products.map((p, i) => ({ code: p.code, name: p.name, sortOrder: i, data: p.data as Prisma.InputJsonValue })),
      },
    },
    include: { createdBy: { select: { id: true, fullName: true } }, products: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } },
  });

  // Reopen the copy on the same product the source was on (ids are new rows).
  const activeIndex = src.products.findIndex((p) => p.id === src.activeProductId);
  if (activeIndex >= 0) {
    await prisma.breakdown.update({ where: { id: copy.id }, data: { activeProductId: copy.products[activeIndex].id } });
  }

  return NextResponse.json({
    id: copy.id,
    name: copy.name,
    createdAt: copy.createdAt,
    updatedAt: copy.updatedAt,
    productCount: copy.products.length,
    productNames: copy.products.slice(0, 3).map((p) => p.name),
    owner: { id: copy.createdBy.id, name: copy.createdBy.fullName },
    access: "owner" as BreakdownAccess,
    canEdit: true,
    sharedWith: [],
    sharedCount: 0,
  });
}
