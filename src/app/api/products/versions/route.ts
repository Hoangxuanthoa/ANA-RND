import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatDDMMYYYY } from "@/lib/mock-data";

// Flat, all-products list — matches mock data's flat PRODUCT_VERSIONS,
// filtered client-side per product by productCode.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.productVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: { select: { productCode: true } }, uploadedBy: { select: { fullName: true } } },
  });
  return NextResponse.json(
    rows.map((v) => ({
      productCode: v.product.productCode,
      number: v.versionNumber,
      note: v.note ?? "",
      by: v.uploadedBy.fullName,
      date: formatDDMMYYYY(v.createdAt),
      image: v.imageUrl ?? undefined,
    })),
  );
}
