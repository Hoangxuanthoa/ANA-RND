import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { normalizeRoundSpec } from "@/lib/breakdown/weaveSpec";

// "Quy cách hàng đan" for every shape that has one, keyed by shape. Readable by
// anyone who can open the breakdown studio (it auto-fills their products);
// edited by Admin only through PUT /api/weave-specs/[shape]. A shape with no
// saved row gets the defaults (empty rule tables = nothing auto-filled).
export async function GET() {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.weaveSpec.findMany();
  const byShape = new Map(rows.map((r) => [r.shape, r.config]));
  return NextResponse.json({ round: normalizeRoundSpec(byShape.get("round")) });
}
