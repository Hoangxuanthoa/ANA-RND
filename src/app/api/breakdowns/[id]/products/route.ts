import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { canEditBreakdown, getBreakdownAccess } from "@/lib/server/breakdown-access";
import { recordActivity } from "@/lib/server/breakdown-activity";

// Single call that hydrates the whole studio page for this breakdown — the
// breakdown's own name/activeProductId (for the header + "which product was
// open last") plus every one of its products' full JSON `data` blob.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const breakdown = await prisma.breakdown.findUnique({
    where: { id },
    include: { products: { orderBy: { sortOrder: "asc" } } },
  });
  if (!breakdown) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    breakdown: { id: breakdown.id, name: breakdown.name, activeProductId: breakdown.activeProductId, access, canEdit: canEditBreakdown(access) },
    products: breakdown.products.map((p) => ({ id: p.id, code: p.code, name: p.name, data: p.data })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const code = typeof body.code === "string" ? body.code : "";
  const name = typeof body.name === "string" ? body.name : code;
  if (!code || body.data === undefined) return NextResponse.json({ error: "Thiếu code hoặc data." }, { status: 400 });

  const count = await prisma.breakdownProduct.count({ where: { breakdownId: id } });
  const created = await prisma.breakdownProduct.create({
    data: { breakdownId: id, code, name, data: body.data as Prisma.InputJsonValue, sortOrder: count },
  });
  // The studio auto-creates a first product for an empty breakdown — not
  // something the person did, so it isn't logged.
  if (count > 0) {
    const fromCode = typeof body.duplicatedFrom === "string" ? body.duplicatedFrom : null;
    const from = fromCode ? await prisma.breakdownProduct.findFirst({ where: { breakdownId: id, code: fromCode }, select: { name: true } }) : null;
    await recordActivity({
      breakdownId: id,
      userId: me.id,
      kind: from ? "product_duplicate" : "product_add",
      productCode: code,
      productName: name,
      summary: from ? `Nhân bản ${from.name} → ${name}` : `Thêm sản phẩm ${name}`,
    });
  }
  return NextResponse.json({ id: created.id, code: created.code, name: created.name, data: created.data });
}
