import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";

// Everyone with Bóc tách access sees every breakdown (not scoped to "mine
// only") — this is a shared internal tool for Admin/R&D/Purchasing working
// off the same quotes, same spirit as the Projects list rather than a
// per-user private workspace.
export async function GET() {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.breakdown.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(
    rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt, productCount: r._count.products })),
  );
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Thiếu tên." }, { status: 400 });

  const created = await prisma.breakdown.create({ data: { name, createdById: me.id } });
  return NextResponse.json({ id: created.id, name: created.name, createdAt: created.createdAt, productCount: 0 });
}
