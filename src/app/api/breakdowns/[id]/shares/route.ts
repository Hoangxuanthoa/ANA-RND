import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { canEditBreakdown, getBreakdownAccess } from "@/lib/server/breakdown-access";

// Who a breakdown can be shared with: active staff who can open "Bóc tách"
// (RND / Mua hàng). Admin is left out — Admin already sees every breakdown —
// and so is the owner.
const SHAREABLE_ROLES = ["RND", "PURCHASING"] as const;

async function loadShareState(breakdownId: string, ownerId: string) {
  const [candidates, shares] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { in: [...SHAREABLE_ROLES] }, id: { not: ownerId } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.breakdownShare.findMany({ where: { breakdownId }, select: { userId: true } }),
  ]);
  return {
    candidates: candidates.map((u) => ({ id: u.id, name: u.fullName, role: u.role })),
    sharedUserIds: shares.map((s) => s.userId),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const breakdown = await prisma.breakdown.findUnique({ where: { id }, select: { createdById: true } });
  if (!breakdown) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await loadShareState(id, breakdown.createdById));
}

// Replaces the whole share list with `userIds` — the modal always sends the
// full set it's showing, so there's no add/remove race to reconcile.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getBreakdownAccess(me, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditBreakdown(access)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body || !Array.isArray(body.userIds) || !body.userIds.every((u) => typeof u === "string")) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const breakdown = await prisma.breakdown.findUnique({ where: { id }, select: { createdById: true } });
  if (!breakdown) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wanted = [...new Set(body.userIds as string[])];
  const valid = await prisma.user.findMany({
    where: { id: { in: wanted, not: breakdown.createdById }, isActive: true, role: { in: [...SHAREABLE_ROLES] } },
    select: { id: true, fullName: true },
  });
  const validIds = valid.map((u) => u.id);

  await prisma.$transaction([
    prisma.breakdownShare.deleteMany({ where: { breakdownId: id, userId: { notIn: validIds } } }),
    prisma.breakdownShare.createMany({ data: validIds.map((userId) => ({ breakdownId: id, userId })), skipDuplicates: true }),
  ]);
  return NextResponse.json({ sharedWith: valid.map((u) => ({ userId: u.id, name: u.fullName })) });
}
