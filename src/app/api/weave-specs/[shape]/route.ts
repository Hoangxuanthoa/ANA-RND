import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { normalizeRoundSpec } from "@/lib/breakdown/weaveSpec";

// Admin saves one shape's "Quy cách". The config is run through the same
// normalizer the studio reads it with, so what's stored is always well-formed.
export async function PUT(request: Request, { params }: { params: Promise<{ shape: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canManageSettings(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shape } = await params;
  if (shape !== "round") return NextResponse.json({ error: "Dáng này chưa có quy cách." }, { status: 404 });

  const body = await parseJsonBody(request);
  if (!body || typeof body.config !== "object" || body.config === null) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const config = normalizeRoundSpec(body.config);
  await prisma.weaveSpec.upsert({
    where: { shape },
    create: { shape, config: config as unknown as Prisma.InputJsonValue },
    update: { config: config as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ round: config });
}
