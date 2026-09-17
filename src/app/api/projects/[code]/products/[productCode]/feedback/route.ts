import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";
import { notify } from "@/lib/server/notify";

export async function POST(request: Request, { params }: { params: Promise<{ code: string; productCode: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Thiếu nội dung." }, { status: 400 });

  const { code, productCode } = await params;
  const project = await prisma.project.findUnique({ where: { projectCode: code } });
  const product = await prisma.product.findUnique({ where: { productCode } });
  if (!project || !product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.projectProduct.findUnique({
    where: { projectId_productId: { projectId: project.id, productId: product.id } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const created = await prisma.feedback.create({
    data: { projectId: project.id, productId: product.id, userId: me.id, content },
  });

  // Prefer the assignee; fall back to the project creator — same as the
  // mock's addProjectProductFeedback.
  const recipientId = item.assigneeId && item.assigneeId !== me.id
    ? item.assigneeId
    : project.createdById !== me.id
      ? project.createdById
      : undefined;
  if (recipientId) {
    await notify({
      userId: recipientId,
      type: "NEW_FEEDBACK",
      title: `Bình luận mới trên ${productCode}`,
      message: content,
      link: `/projects/${code}?product=${productCode}`,
    });
  }

  return NextResponse.json({
    projectCode: code,
    productCode,
    content: created.content,
    time: relativeTimeVi(created.createdAt),
    ...feedbackAuthor(me.fullName, me.role),
  });
}
