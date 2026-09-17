import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";
import { notifyMany } from "@/lib/server/notify";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Thiếu nội dung." }, { status: 400 });

  const { id } = await params;
  const photo = await prisma.projectPhoto.findUnique({ where: { id }, include: { project: true } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const created = await prisma.feedback.create({
    data: { projectPhotoId: id, userId: me.id, content },
  });

  // Relevant stakeholders for a photo comment: whoever uploaded it, and
  // the project's creator — same "notify both" idea as general project
  // feedback (see projects/[code]/feedback/route.ts).
  await notifyMany(
    {
      type: "NEW_FEEDBACK",
      title: `Bình luận mới trên ${photo.fileName}`,
      message: content,
      link: `/projects/${photo.project.projectCode}?tab=photos`,
    },
    [photo.uploadedById, photo.project.createdById],
    [me.id],
  );

  return NextResponse.json({
    photoId: id,
    content: created.content,
    time: relativeTimeVi(created.createdAt),
    ...feedbackAuthor(me.fullName, me.role),
  });
}
