import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Thiếu nội dung." }, { status: 400 });

  const { id } = await params;
  const created = await prisma.feedback.create({
    data: { projectPhotoId: id, userId: me.id, content },
  });

  return NextResponse.json({
    photoId: id,
    content: created.content,
    time: relativeTimeVi(created.createdAt),
    ...feedbackAuthor(me.fullName, me.role),
  });
}
