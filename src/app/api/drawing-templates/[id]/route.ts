import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canManageDrawingTemplates } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDrawingTemplates(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Prisma.DrawingTemplateUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.companyName === "string") data.companyName = body.companyName;
  if ("logoDataUrl" in body) data.logoDataUrl = typeof body.logoDataUrl === "string" ? body.logoDataUrl : null;
  if (body.views !== undefined) data.views = body.views as Prisma.InputJsonValue;
  if (body.fields !== undefined) data.fields = body.fields as Prisma.InputJsonValue;
  if (typeof body.titleBlockWidthMm === "number") data.titleBlockWidthMm = body.titleBlockWidthMm;
  if (typeof body.fieldRowMinHeightMm === "number") data.fieldRowMinHeightMm = body.fieldRowMinHeightMm;
  if (typeof body.showViewFrame === "boolean") data.showViewFrame = body.showViewFrame;

  const updated = await prisma.drawingTemplate.update({ where: { id }, data });
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    companyName: updated.companyName,
    logoDataUrl: updated.logoDataUrl,
    views: updated.views,
    fields: updated.fields,
    titleBlockWidthMm: updated.titleBlockWidthMm,
    fieldRowMinHeightMm: updated.fieldRowMinHeightMm,
    showViewFrame: updated.showViewFrame,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDrawingTemplates(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const count = await prisma.drawingTemplate.count();
  if (count <= 1) return NextResponse.json({ error: "Phải giữ ít nhất 1 template." }, { status: 400 });

  await prisma.drawingTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
