import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";

// Project-level general feedback only (projectId set, productId null) —
// a row with both set belongs to a specific project+product thread
// instead (see /api/projects/products/feedback).
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.feedback.findMany({
    where: { projectId: { not: null }, productId: null, projectPhotoId: null },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { fullName: true, role: true } }, project: { select: { projectCode: true } } },
  });
  return NextResponse.json(
    rows.map((f) => ({
      projectCode: f.project!.projectCode,
      content: f.content,
      time: relativeTimeVi(f.createdAt),
      ...feedbackAuthor(f.user.fullName, f.user.role),
    })),
  );
}
