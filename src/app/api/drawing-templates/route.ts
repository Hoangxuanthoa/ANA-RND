import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canManageDrawingTemplates, canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";

function serialize(row: {
  id: string;
  name: string;
  companyName: string;
  logoDataUrl: string | null;
  views: Prisma.JsonValue;
  fields: Prisma.JsonValue;
  titleBlockWidthMm: number;
  fieldRowMinHeightMm: number;
  showViewFrame: boolean;
}) {
  return {
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    logoDataUrl: row.logoDataUrl,
    views: row.views,
    fields: row.fields,
    titleBlockWidthMm: row.titleBlockWidthMm,
    fieldRowMinHeightMm: row.fieldRowMinHeightMm,
    showViewFrame: row.showViewFrame,
  };
}

const DEFAULT_VIEWS = ["front", "left", "top", "iso"];
const DEFAULT_FIELDS = [
  { id: "f-default-1", label: "Tên bản vẽ", autoFill: "productName" },
  { id: "f-default-2", label: "Mã bản vẽ" },
  { id: "f-default-3", label: "Số lượng" },
  { id: "f-default-4", label: "Nguyên liệu" },
  { id: "f-default-5", label: "Xử lý bề mặt" },
  { id: "f-default-6", label: "Thiết kế" },
  { id: "f-default-7", label: "Người check" },
  { id: "f-default-8", label: "Ngày", autoFill: "today" },
  { id: "f-default-9", label: "Dung sai (mm)" },
];

// Global, shared by every breakdown/product — readable by anyone who can
// open the breakdown studio, writable by Admin only (see
// canManageDrawingTemplates). Bootstraps one "Mặc định" row the first time
// anyone asks, same spirit as a breakdown's own first-product bootstrap, so
// there's always at least one template to pick even before Admin has
// created any.
export async function GET() {
  const me = await getSessionUser();
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.drawingTemplate.count();
  if (count === 0) {
    await prisma.drawingTemplate.create({
      data: {
        name: "Mặc định",
        companyName: "Artex Nam An",
        views: DEFAULT_VIEWS,
        fields: DEFAULT_FIELDS,
        titleBlockWidthMm: 70,
        fieldRowMinHeightMm: 10.8,
        showViewFrame: true,
      },
    });
  }

  const rows = await prisma.drawingTemplate.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ templates: rows.map(serialize) });
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDrawingTemplates(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body || typeof body.name !== "string") return NextResponse.json({ error: "Thiếu name." }, { status: 400 });

  const created = await prisma.drawingTemplate.create({
    data: {
      name: body.name,
      companyName: typeof body.companyName === "string" ? body.companyName : "",
      logoDataUrl: typeof body.logoDataUrl === "string" ? body.logoDataUrl : null,
      views: (body.views ?? DEFAULT_VIEWS) as Prisma.InputJsonValue,
      fields: (body.fields ?? []) as Prisma.InputJsonValue,
      titleBlockWidthMm: typeof body.titleBlockWidthMm === "number" ? body.titleBlockWidthMm : 70,
      fieldRowMinHeightMm: typeof body.fieldRowMinHeightMm === "number" ? body.fieldRowMinHeightMm : 10.8,
      showViewFrame: typeof body.showViewFrame === "boolean" ? body.showViewFrame : true,
    },
  });
  return NextResponse.json(serialize(created));
}
