import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Rename and/or deactivate. "Xóa" in Settings deactivates (isActive:
// false) rather than hard-deleting — same reasoning as Staff's account
// deactivation: a real product can already point at this row, and unlike
// the mock version there's no "blocked while in use" check needed, since
// a soft-deactivated row just stops showing up in pickers everywhere
// else while every product that already used it keeps working.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const data: { name?: string; isActive?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await prisma.category.update({ where: { id }, data });
  return NextResponse.json(updated);
}
