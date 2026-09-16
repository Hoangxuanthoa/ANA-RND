import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// AppSettings is a singleton — there's never more than one row. Readable
// by any signed-in role (the PPTX export page needs it and isn't
// Admin-only), writable by Admin only (matches Settings' own page gate).
function serialize(row: { pptxCoverImage: string | null; pptxClosingImage: string | null; pptxClosingText: string } | null) {
  return {
    coverImage: row?.pptxCoverImage ?? undefined,
    closingImage: row?.pptxClosingImage ?? undefined,
    closingText: row?.pptxClosingText ?? "Cảm ơn quý khách",
  };
}

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.appSettings.findFirst();
  return NextResponse.json(serialize(row));
}

interface PatchBody {
  coverImage?: string | null;
  closingImage?: string | null;
  closingText?: string;
}

export async function PATCH(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: PatchBody = await request.json();
  const data: Record<string, unknown> = {};
  if ("coverImage" in body) data.pptxCoverImage = body.coverImage || null;
  if ("closingImage" in body) data.pptxClosingImage = body.closingImage || null;
  if ("closingText" in body && body.closingText) data.pptxClosingText = body.closingText;

  const existing = await prisma.appSettings.findFirst();
  const row = existing
    ? await prisma.appSettings.update({ where: { id: existing.id }, data })
    : await prisma.appSettings.create({ data });

  return NextResponse.json(serialize(row));
}
