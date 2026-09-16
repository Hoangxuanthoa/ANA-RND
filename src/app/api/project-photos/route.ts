import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectPhotoInclude, serializeProjectPhoto } from "@/lib/server/serialize-project-photo";

// Flat, all-projects list — matches the mock's flat photos array,
// filtered client-side per project by projectCode.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.projectPhoto.findMany({
    orderBy: { createdAt: "desc" },
    include: projectPhotoInclude(),
  });
  return NextResponse.json(rows.map(serializeProjectPhoto));
}

interface AddBody {
  projectCode?: string;
  files?: { fileName: string; url: string }[];
}

// One call for the whole batch, same reasoning as Products'
// createProductsBulk — a multi-file upload lands as one insert.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: AddBody = await request.json();
  const files = body.files ?? [];
  if (!body.projectCode || files.length === 0) {
    return NextResponse.json({ error: "Thiếu projectCode/files." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { projectCode: body.projectCode } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.projectPhoto.createMany({
    data: files.map((f) => ({
      projectId: project.id,
      fileName: f.fileName,
      fileUrl: f.url,
      uploadedById: me.id,
    })),
  });

  const created = await prisma.projectPhoto.findMany({
    where: { projectId: project.id, uploadedById: me.id },
    orderBy: { createdAt: "desc" },
    take: files.length,
    include: projectPhotoInclude(),
  });
  return NextResponse.json(created.map(serializeProjectPhoto));
}
