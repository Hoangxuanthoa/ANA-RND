import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { relativeTimeVi } from "@/lib/mock-data";
import { feedbackAuthor } from "@/lib/server/identity";

// Flat, all-photos list of comments — matches the mock's embedded
// ProjectPhoto.comments[], reassembled client-side per photo.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.feedback.findMany({
    where: { projectPhotoId: { not: null } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { fullName: true, role: true } } },
  });
  return NextResponse.json(
    rows.map((f) => ({
      photoId: f.projectPhotoId,
      content: f.content,
      time: relativeTimeVi(f.createdAt),
      ...feedbackAuthor(f.user.fullName, f.user.role),
    })),
  );
}
