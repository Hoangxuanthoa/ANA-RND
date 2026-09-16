import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { collectionInclude, serializeCollection } from "@/lib/server/serialize-collection";
import { notify } from "@/lib/server/notify";

// Logging a pitch is available to anyone who can see Collections at all
// (not gated by ownership or DRAFT status — "Xuất Collection"/"Lấy link
// online" work on someone else's collection too) and always moves it to
// SENT. The first time this ever happens for a collection, it also mints
// a real publicSlug — an unguessable id for the public share page,
// generated here (not client-side) so it's guaranteed server-authoritative.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role === "CUSTOMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const customerName = typeof body.customer === "string" ? body.customer.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!customerName) return NextResponse.json({ error: "Thiếu tên khách hàng." }, { status: 400 });

  await prisma.collectionPitch.create({
    data: { collectionId: id, customerName, note: note || null, loggedById: me.id },
  });

  const updated = await prisma.collection.update({
    where: { id },
    data: { status: "SENT", publicSlug: collection.publicSlug ?? randomUUID() },
    include: collectionInclude(),
  });

  if (collection.createdById !== me.id) {
    await notify({
      userId: collection.createdById,
      type: "NEW_PITCH",
      title: `Collection "${collection.name}" vừa được chào ${customerName}`,
      message: note || `Đã chào ${customerName}.`,
      link: `/collections/${id}`,
    });
  }

  return NextResponse.json(serializeCollection(updated));
}
