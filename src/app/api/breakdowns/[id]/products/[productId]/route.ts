import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";

// The main autosave endpoint — the studio page PATCHes whichever product is
// currently active after its own debounce, same cadence the old IndexedDB
// save used (see anasu-web's studio/[projectId]/page.tsx history).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, productId } = await params;
  const body = await request.json();
  const data: { name?: string; data?: Prisma.InputJsonValue } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (body.data !== undefined) data.data = body.data as Prisma.InputJsonValue;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await prisma.breakdownProduct.update({
    where: { id: productId, breakdownId: id },
    data,
  });
  return NextResponse.json({ id: updated.id, code: updated.code, name: updated.name, data: updated.data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, productId } = await params;
  await prisma.breakdownProduct.delete({ where: { id: productId, breakdownId: id } });
  return NextResponse.json({ ok: true });
}
