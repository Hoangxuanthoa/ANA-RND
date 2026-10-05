import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { canEditBreakdown, getBreakdownAccess } from "@/lib/server/breakdown-access";

// "Lịch sử chỉnh sửa" feed, newest first. Only people who manage the breakdown
// (owner / Admin) can read it for now — a share recipient who can only look
// doesn't need to see who touched what.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 200, 1), 500);
  const rows = await prisma.breakdownActivity.findMany({
    where: { breakdownId: id },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, fullName: true } } },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      summary: r.summary,
      productCode: r.productCode,
      user: { id: r.user.id, name: r.user.fullName },
      // A merged edit row spans a stretch of work: it started at createdAt and
      // was last extended at updatedAt.
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}
