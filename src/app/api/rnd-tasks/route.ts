import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { rndTaskInclude, serializeRndTask, CATEGORY_VALUE } from "@/lib/server/serialize-rnd-task";
import { PRIORITY_VALUE } from "@/lib/server/serialize-project";
import { parseDeadline } from "@/lib/server/dates";
import type { TaskCategory, TaskPriority } from "@/lib/mock-data";

// Full list, readable by any signed-in role — same trust model as
// GET /api/products: My Task's own page (RND/ADMIN only, canViewMyTasks)
// is what actually restricts who ever sees this, not the route itself.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.rndTask.findMany({
    orderBy: { createdAt: "desc" },
    include: rndTaskInclude(),
  });
  return NextResponse.json(rows.map(serializeRndTask));
}

interface CreateBody {
  title?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  requester?: string;
  startDate?: string;
  deadline?: string;
}

// Always self-owned — "Thêm công việc" only ever adds to your own list,
// there's no reassignment feature (see my-tasks/page.tsx).
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "RND" && me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: CreateBody = await request.json();
  const title = body.title?.trim();
  if (!title || !body.category || !body.priority || !body.deadline) {
    return NextResponse.json({ error: "Thiếu thông tin công việc." }, { status: 400 });
  }

  const requester = body.requester ? await prisma.user.findFirst({ where: { fullName: body.requester } }) : null;

  const created = await prisma.rndTask.create({
    data: {
      ownerId: me.id,
      title,
      category: CATEGORY_VALUE[body.category],
      priority: PRIORITY_VALUE[body.priority],
      requesterId: requester?.id,
      startDate: body.startDate ? parseDeadline(body.startDate) : null,
      deadline: parseDeadline(body.deadline),
    },
    include: rndTaskInclude(),
  });

  return NextResponse.json(serializeRndTask(created));
}
