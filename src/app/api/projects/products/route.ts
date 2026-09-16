import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectProductInclude, serializeProjectProduct } from "@/lib/server/serialize-project";

// Flat, all-projects list — matches mock data's flat PROJECT_PRODUCTS,
// filtered client-side per project by projectCode.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.projectProduct.findMany({
    orderBy: { createdAt: "asc" },
    include: { ...projectProductInclude(), project: { select: { projectCode: true } }, product: { select: { productCode: true } } },
  });
  return NextResponse.json(rows.map(serializeProjectProduct));
}
