import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectInclude, serializeProject } from "@/lib/server/serialize-project";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const project = await prisma.project.findUnique({ where: { projectCode: code } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.role !== "ADMIN" && project.createdById !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { status: "CLOSED" },
    include: projectInclude(),
  });
  return NextResponse.json(serializeProject(updated));
}
