import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { rndTaskInclude, serializeRndTask, CATEGORY_VALUE } from "@/lib/server/serialize-rnd-task";
import { PRIORITY_VALUE } from "@/lib/server/serialize-project";
import { parseDeadline } from "@/lib/server/dates";
import { notify } from "@/lib/server/notify";
import type { TaskCategory, TaskPriority } from "@/lib/mock-data";

function isOwner(me: { id: string; role: string }, task: { ownerId: string }) {
  return me.role === "ADMIN" || task.ownerId === me.id;
}

interface PatchBody {
  title?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  requester?: string;
  startDate?: string | null;
  deadline?: string;
  completedAt?: string | null;
  needsSupport?: string | null;
  importantNote?: string | null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.rndTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isOwner(me, task)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: PatchBody = await request.json();
  // Admin-only even for a task's own owner — matches the UI, which never
  // shows an edit control for this field to anyone but Admin.
  if ("importantNote" in body && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if ("title" in body && body.title) data.title = body.title.trim();
  if ("category" in body && body.category) data.category = CATEGORY_VALUE[body.category];
  if ("priority" in body && body.priority) data.priority = PRIORITY_VALUE[body.priority];
  if ("startDate" in body) data.startDate = body.startDate ? parseDeadline(body.startDate) : null;
  if ("deadline" in body && body.deadline) data.deadline = parseDeadline(body.deadline);
  if ("completedAt" in body) data.completedAt = body.completedAt ? parseDeadline(body.completedAt) : null;
  if ("needsSupport" in body) data.needsSupport = body.needsSupport || null;
  if ("importantNote" in body) data.importantNote = body.importantNote || null;

  let requesterId: string | null | undefined;
  if ("requester" in body) {
    const requester = body.requester ? await prisma.user.findFirst({ where: { fullName: body.requester } }) : null;
    requesterId = requester?.id ?? null;
    data.requesterId = requesterId;
  }

  const updated = await prisma.rndTask.update({ where: { id }, data, include: rndTaskInclude() });

  // R&D flagging "cần hỗ trợ" — pings Admin, same trigger as
  // ProjectsProvider's real setProjectNeedsSupport.
  if ("needsSupport" in body && body.needsSupport?.trim()) {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (admin && admin.id !== me.id) {
      await notify({
        userId: admin.id,
        type: "RND_NEEDS_SUPPORT",
        title: `${updated.title} cần hỗ trợ`,
        message: body.needsSupport.trim(),
        link: "/my-tasks",
      });
    }
  }

  // Admin writing a directive down to the task's owner — same trigger as
  // ProjectsProvider's real setProjectImportantNote.
  if ("importantNote" in body && body.importantNote?.trim() && task.ownerId !== me.id) {
    await notify({
      userId: task.ownerId,
      type: "ADMIN_IMPORTANT_NOTE",
      title: `Admin gửi lưu ý cho "${updated.title}"`,
      message: body.importantNote.trim(),
      link: "/my-tasks",
    });
  }

  return NextResponse.json(serializeRndTask(updated));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.rndTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isOwner(me, task)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.rndTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
