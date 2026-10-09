import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canOpenBreakdownSettings } from "@/lib/server/breakdown-settings-access";
import { parseJsonBody } from "@/lib/server/parse-json";
import { normalizeSpec, SPEC_SHAPES, type SpecShape } from "@/lib/breakdown/weaveSpec";

// Whoever may open Cài đặt Bóc tách (Admin, plus any role Admin has switched on)
// saves one shape's "Quy cách". The config is run through the same normalizer the
// studio reads it with, so what's stored is always well-formed.
export async function PUT(request: Request, { params }: { params: Promise<{ shape: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !(await canOpenBreakdownSettings(me))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shape } = await params;
  if (!SPEC_SHAPES.includes(shape as SpecShape)) return NextResponse.json({ error: "Dáng này chưa có quy cách." }, { status: 404 });

  const body = await parseJsonBody(request);
  if (!body || typeof body.config !== "object" || body.config === null) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const config = normalizeSpec(shape as SpecShape, body.config);
  await prisma.weaveSpec.upsert({
    where: { shape },
    create: { shape, config: config as unknown as Prisma.InputJsonValue },
    update: { config: config as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ config });
}
