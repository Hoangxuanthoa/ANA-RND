import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";

// Product-scoped feedback only (productId set, projectId null) — a row
// with both set belongs to the Projects module's own project+product
// feedback thread, not this one.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.feedback.findMany({
    where: { productId: { not: null }, projectId: null },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { fullName: true, role: true } }, product: { select: { productCode: true } } },
  });
  return NextResponse.json(
    rows.map((f) => ({
      productCode: f.product!.productCode,
      content: f.content,
      time: relativeTimeVi(f.createdAt),
      ...feedbackAuthor(f.user.fullName, f.user.role),
    })),
  );
}
