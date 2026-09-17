import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";
import { notifyMany } from "@/lib/server/notify";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Thiếu nội dung." }, { status: 400 });

  const { code } = await params;
  const project = await prisma.project.findUnique({ where: { projectCode: code } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const created = await prisma.feedback.create({
    data: { projectId: project.id, userId: me.id, content },
  });

  // Both real stakeholders of the project — its creator (Sales/Marketing/
  // Admin) and its assigned R&D owner — should hear about a comment even
  // if only one of them happens to be the one commenting.
  await notifyMany(
    {
      type: "NEW_FEEDBACK",
      title: `Bình luận mới trong dự án ${project.projectName}`,
      message: content,
      link: `/projects/${code}`,
    },
    [project.createdById, project.rndOwnerId ?? undefined],
    [me.id],
  );

  return NextResponse.json({
    projectCode: code,
    content: created.content,
    time: relativeTimeVi(created.createdAt),
    ...feedbackAuthor(me.fullName, me.role),
  });
}
