import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json(rows);
}

// A category can be a top-level one or a child of exactly one top-level
// category — two levels deep, no more (a child can never itself be
// picked as someone else's parent), which is all the "category cha /
// category con" grouping the Library filter and upload form need.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Thiếu tên." }, { status: 400 });

  const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent || !parent.isActive) return NextResponse.json({ error: "Category cha không hợp lệ." }, { status: 400 });
    if (parent.parentId) return NextResponse.json({ error: "Category con không thể có thêm category con." }, { status: 400 });
  }

  const created = await prisma.category.create({ data: { name, parentId } });
  return NextResponse.json(created);
}
