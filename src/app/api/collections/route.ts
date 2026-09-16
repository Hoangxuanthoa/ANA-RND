import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { collectionInclude, serializeCollection } from "@/lib/server/serialize-collection";

// Full list, readable by any signed-in role (Customer never sees the UI
// that calls this — canManageCollections gates it client-side — but the
// provider that fetches it is mounted globally, same trust model as
// GET /api/products).
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.collection.findMany({
    orderBy: { createdAt: "desc" },
    include: collectionInclude(),
  });
  return NextResponse.json(rows.map(serializeCollection));
}

interface CreateBody {
  name?: string;
  productCodes?: string[];
  sourceProjectCode?: string;
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role === "CUSTOMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: CreateBody = await request.json();
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Thiếu tên collection." }, { status: 400 });

  const [project, products] = await Promise.all([
    body.sourceProjectCode ? prisma.project.findUnique({ where: { projectCode: body.sourceProjectCode } }) : null,
    body.productCodes?.length
      ? prisma.product.findMany({ where: { productCode: { in: body.productCodes } } })
      : Promise.resolve([]),
  ]);

  // Preserve the caller's order (findMany doesn't guarantee it) and
  // silently drop any code that doesn't resolve to a real product.
  const productByCode = new Map(products.map((p) => [p.productCode, p]));
  const itemsCreate = (body.productCodes ?? [])
    .map((code) => productByCode.get(code))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ productId: p.id }));

  const created = await prisma.collection.create({
    data: {
      name,
      createdById: me.id,
      projectId: project?.id,
      items: { create: itemsCreate },
    },
    include: collectionInclude(),
  });

  return NextResponse.json(serializeCollection(created));
}
