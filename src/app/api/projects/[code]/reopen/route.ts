import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectInclude, serializeProject } from "@/lib/server/serialize-project";

// Admin-only (canReopenProject in lib/permissions.ts) — undoes
// closeProject. There's no stored "status before close" to restore, so
// this recomputes whatever active status the project's own product
// completion naturally implies: no products at all -> back to CREATED;
// some products but not all Approved -> DEVELOPING; every product
// already Approved -> COMPLETED (mirrors the auto-complete rule in the
// approve route).
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await params;
  const project = await prisma.project.findUnique({ where: { projectCode: code } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status !== "CLOSED") {
    return NextResponse.json({ error: "Dự án chưa đóng." }, { status: 400 });
  }

  const items = await prisma.projectProduct.findMany({ where: { projectId: project.id } });
  const nextStatus =
    items.length === 0 ? "CREATED" : items.every((i) => i.status === "APPROVED") ? "COMPLETED" : "DEVELOPING";

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { status: nextStatus },
    include: projectInclude(),
  });
  return NextResponse.json(serializeProject(updated));
}
