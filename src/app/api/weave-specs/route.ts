import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { normalizeSpec, SPEC_SHAPES } from "@/lib/breakdown/weaveSpec";

// "Quy cách hàng đan" for every shape, keyed by shape. Readable by anyone who can
// open the breakdown studio (it auto-fills their products); edited through PUT
// /api/weave-specs/[shape] by whoever may open Cài đặt Bóc tách. A shape with no
// saved row gets the defaults (empty rule tables = nothing auto-filled).
export async function GET() {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.weaveSpec.findMany();
  const byShape = new Map(rows.map((r) => [r.shape, r.config]));
  return NextResponse.json({ specs: Object.fromEntries(SPEC_SHAPES.map((s) => [s, normalizeSpec(s, byShape.get(s))])) });
}
