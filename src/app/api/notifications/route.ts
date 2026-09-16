import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";

// Always just "my own" — filtered server-side by session userId, never
// by a client-sent name (see notify() writing real userId-addressed
// rows).
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link ?? "",
      isRead: n.isRead,
      time: relativeTimeVi(n.createdAt),
    })),
  );
}
