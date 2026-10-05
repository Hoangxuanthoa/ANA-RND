import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import type { BreakdownAccess } from "@/lib/server/breakdown-access";
import { recordActivity } from "@/lib/server/breakdown-activity";

// Each person sees only their own breakdowns plus the ones shared WITH them;
// Admin sees every breakdown. (See lib/server/breakdown-access.ts for the
// full owner/admin/shared rules the per-breakdown routes enforce.)
export async function GET() {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = me.role === "ADMIN";
  const rows = await prisma.breakdown.findMany({
    where: isAdmin ? undefined : { OR: [{ createdById: me.id }, { shares: { some: { userId: me.id } } }] },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      products: { orderBy: { sortOrder: "asc" }, select: { name: true, updatedAt: true } },
      shares: { include: { user: { select: { id: true, fullName: true } } } },
    },
  });

  return NextResponse.json(
    rows.map((r) => {
      const access: BreakdownAccess = r.createdById === me.id ? "owner" : isAdmin ? "admin" : "shared";
      const canEdit = access === "owner" || access === "admin";
      // Last activity = the breakdown itself or any product's autosave.
      const lastTouched = [r.updatedAt, ...r.products.map((p) => p.updatedAt)].reduce((a, b) => (a > b ? a : b));
      return {
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        updatedAt: lastTouched,
        productCount: r.products.length,
        productNames: r.products.slice(0, 3).map((p) => p.name),
        owner: { id: r.createdBy.id, name: r.createdBy.fullName },
        access,
        canEdit,
        // Only people who can manage sharing need to see who it's shared with.
        sharedWith: canEdit ? r.shares.map((s) => ({ userId: s.user.id, name: s.user.fullName })) : [],
        sharedCount: r.shares.length,
      };
    }),
  );
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Thiếu tên." }, { status: 400 });

  const created = await prisma.breakdown.create({ data: { name, createdById: me.id }, include: { createdBy: { select: { id: true, fullName: true } } } });
  await recordActivity({ breakdownId: created.id, userId: me.id, kind: "create", summary: "Tạo hồ sơ" });
  return NextResponse.json({
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    productCount: 0,
    productNames: [],
    owner: { id: created.createdBy.id, name: created.createdBy.fullName },
    access: "owner" as BreakdownAccess,
    canEdit: true,
    sharedWith: [],
    sharedCount: 0,
  });
}
