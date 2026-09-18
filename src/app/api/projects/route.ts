import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectInclude, serializeProject } from "@/lib/server/serialize-project";
import { nextProjectCode } from "@/lib/server/project-codes";
import { notify, notifyAllAdmins } from "@/lib/server/notify";
import { parseDeadline } from "@/lib/server/dates";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: projectInclude(),
  });
  return NextResponse.json(rows.map(serializeProject));
}

// creatableProjectTypes(role) in lib/permissions.ts, re-checked here
// since the client role is never trusted.
function allowedTypesFor(role: string): Set<"CUSTOMER" | "INTERNAL" | "MARKETING"> {
  if (role === "ADMIN") return new Set(["CUSTOMER", "INTERNAL", "MARKETING"]);
  if (role === "SALES") return new Set(["CUSTOMER"]);
  if (role === "MARKETING") return new Set(["MARKETING", "CUSTOMER"]);
  if (role === "CUSTOMER") return new Set(["CUSTOMER"]);
  return new Set();
}

interface CreateBody {
  name?: string;
  type?: "CUSTOMER" | "INTERNAL" | "MARKETING";
  customer?: string;
  sales?: string;
  rndOwner?: string;
  deadline?: string;
  brief?: string;
  attachments?: { fileName: string; fileUrl: string }[];
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: CreateBody = await request.json();
  const name = body.name?.trim();
  const type = body.type;
  if (!name || !type || !allowedTypesFor(me.role).has(type)) {
    return NextResponse.json({ error: "Thiếu tên hoặc loại dự án không hợp lệ." }, { status: 400 });
  }

  // A Customer request has no real customer login behind it (Customer
  // is always an Admin-preview role) — it's routed to whichever Sales
  // rep is picked, same as the mock's fixed "JYSK" persona.
  const customerName = type === "CUSTOMER" ? (me.role === "CUSTOMER" ? "JYSK" : body.customer) : undefined;
  const [customer, sales, rndOwner] = await Promise.all([
    customerName ? prisma.customer.findFirst({ where: { name: customerName } }) : null,
    body.sales ? prisma.user.findFirst({ where: { fullName: body.sales, role: "SALES" } }) : null,
    body.rndOwner ? prisma.user.findFirst({ where: { fullName: body.rndOwner, role: { in: ["RND", "ADMIN"] } } }) : null,
  ]);

  // A Customer request is owned by the Sales rep it's routed to from
  // the start — the customer submitted it, but Sales manages it going
  // forward (edit, assign R&D, etc.), same as the mock.
  const createdById = me.role === "CUSTOMER" ? sales?.id : undefined;
  if (me.role === "CUSTOMER" && !createdById) {
    return NextResponse.json({ error: "Thiếu Sales phụ trách." }, { status: 400 });
  }

  const deadline = body.deadline && body.deadline !== "—" ? parseDeadline(body.deadline) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const projectCode = await nextProjectCode(type);
    try {
      const attachments = (body.attachments ?? []).filter((a) => a.fileName && a.fileUrl);
      const created = await prisma.project.create({
        data: {
          projectCode,
          projectName: name,
          type,
          customerId: customer?.id,
          salesId: sales?.id,
          rndOwnerId: rndOwner?.id,
          createdById: createdById ?? me.id,
          deadline,
          brief: body.brief?.trim() || null,
          status: "CREATED",
          attachments: attachments.length
            ? { create: attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl, uploadedById: me.id })) }
            : undefined,
        },
        include: projectInclude(),
      });

      if (me.role === "CUSTOMER" && sales) {
        await notify({
          userId: sales.id,
          type: "PROJECT_REQUESTED_BY_CUSTOMER",
          title: "Khách hàng vừa gửi yêu cầu dự án mới",
          message: `${created.projectName} — cần bạn gán R&D phụ trách.`,
          link: `/projects/${projectCode}`,
        });
      }

      // Every new project, regardless of type or who created it — Admin
      // wants team-wide visibility into everything that gets created.
      await notifyAllAdmins(
        {
          type: "PROJECT_CREATED",
          title: "Dự án mới vừa được tạo",
          message: `${created.projectName} (${projectCode})${customerName ? ` — khách hàng ${customerName}` : ""}.`,
          link: `/projects/${projectCode}`,
        },
        [me.id],
      );

      // An R&D owner assigned right at creation (not via a later edit —
      // that path already notifies in PATCH /api/projects/[code]).
      if (rndOwner && rndOwner.id !== me.id) {
        await notify({
          userId: rndOwner.id,
          type: "PROJECT_ASSIGNED",
          title: "Bạn được gán phụ trách dự án mới",
          message: `${created.projectName} cần bạn xử lý.`,
          link: `/projects/${projectCode}`,
        });
      }

      return NextResponse.json(serializeProject(created));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "Không tạo được mã dự án — thử lại." }, { status: 500 });
}
