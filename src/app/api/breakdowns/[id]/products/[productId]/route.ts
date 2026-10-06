import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { canEditBreakdown, getBreakdownAccess } from "@/lib/server/breakdown-access";
import { changedGroups, recordActivity, recordProductEdit } from "@/lib/server/breakdown-activity";

// The main autosave endpoint — the studio page PATCHes whichever product is
// currently active after its own debounce, same cadence the old IndexedDB
// save used (see anasu-web's studio/[projectId]/page.tsx history).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, productId } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const data: { name?: string; data?: Prisma.InputJsonValue } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (body.data !== undefined) data.data = body.data as Prisma.InputJsonValue;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const before = await prisma.breakdownProduct.findUnique({ where: { id: productId, breakdownId: id }, select: { name: true, data: true } });
  const updated = await prisma.breakdownProduct.update({
    where: { id: productId, breakdownId: id },
    data,
  });
  if (before) {
    const groups = changedGroups(before.data, updated.data);
    // The name lives in its own column AND inside data — either may carry the rename.
    if (before.name !== updated.name && !groups.includes("tên")) groups.unshift("tên");
    await recordProductEdit({ breakdownId: id, userId: me.id, productCode: updated.code, productName: updated.name, groups });
  }
  return NextResponse.json({ id: updated.id, code: updated.code, name: updated.name, data: updated.data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, productId } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const doomed = await prisma.breakdownProduct.findUnique({ where: { id: productId, breakdownId: id }, select: { code: true, name: true } });
  await prisma.breakdownProduct.delete({ where: { id: productId, breakdownId: id } });
  if (doomed) {
    await recordActivity({ breakdownId: id, userId: me.id, kind: "product_delete", productCode: doomed.code, productName: doomed.name, summary: `Xóa sản phẩm ${doomed.name}` });
  }
  return NextResponse.json({ ok: true });
}
