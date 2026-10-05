import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { canEditBreakdown, getBreakdownAccess } from "@/lib/server/breakdown-access";

// Persists the product order the studio's ▲/▼ buttons produce. The client
// sends the product row ids in their new order; any product of this breakdown
// it didn't mention (e.g. one whose create-POST was still in flight) keeps its
// current relative order after the listed ones, so sortOrder always ends up a
// clean 0..n-1 sequence with no ties.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body || !Array.isArray(body.order) || !body.order.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.breakdownProduct.findMany({ where: { breakdownId: id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const existingIds = new Set(existing.map((p) => p.id));
  const listed = [...new Set(body.order as string[])].filter((pid) => existingIds.has(pid));
  const listedSet = new Set(listed);
  const finalOrder = [...listed, ...existing.map((p) => p.id).filter((pid) => !listedSet.has(pid))];

  await prisma.$transaction(finalOrder.map((pid, index) => prisma.breakdownProduct.update({ where: { id: pid }, data: { sortOrder: index } })));
  return NextResponse.json({ ok: true });
}
