import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { collectionInclude, serializeCollection } from "@/lib/server/serialize-collection";

// Matches canEditCollection in lib/permissions.ts: only while it's still
// DRAFT (SENT is a locked snapshot of what was actually shared), and only
// its own creator or Admin.
function isEditable(me: { id: string; role: string }, collection: { createdById: string; status: string }) {
  return collection.status === "DRAFT" && (me.role === "ADMIN" || collection.createdById === me.id);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEditable(me, collection)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Thiếu tên collection." }, { status: 400 });

  const updated = await prisma.collection.update({ where: { id }, data: { name }, include: collectionInclude() });
  return NextResponse.json(serializeCollection(updated));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEditable(me, collection)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.collection.delete({ where: { id } }); // cascades items + pitches
  return NextResponse.json({ ok: true });
}
