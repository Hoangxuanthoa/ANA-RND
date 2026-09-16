import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";

// Flat, all-projects list of project+product feedback (both projectId
// and productId set) — matches mock data's embedded
// ProjectProductItem.feedback[], reassembled client-side per item.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.feedback.findMany({
    where: { projectId: { not: null }, productId: { not: null } },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { fullName: true, role: true } },
      project: { select: { projectCode: true } },
      product: { select: { productCode: true } },
    },
  });
  return NextResponse.json(
    rows.map((f) => ({
      projectCode: f.project!.projectCode,
      productCode: f.product!.productCode,
      content: f.content,
      time: relativeTimeVi(f.createdAt),
      ...feedbackAuthor(f.user.fullName, f.user.role),
    })),
  );
}
