import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { canEditBreakdown, getBreakdownAccess } from "@/lib/server/breakdown-access";

// Rename / change the product the studio reopens to — owner and Admin only
// (a share recipient is read-only; see lib/server/breakdown-access.ts).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const data: { name?: string; activeProductId?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("activeProductId" in body) data.activeProductId = typeof body.activeProductId === "string" ? body.activeProductId : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await prisma.breakdown.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, activeProductId: updated.activeProductId });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.breakdown.delete({ where: { id } }); // cascades to products and shares
  return NextResponse.json({ ok: true });
}
