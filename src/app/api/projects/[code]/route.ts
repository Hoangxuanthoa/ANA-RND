import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { projectInclude, serializeProject, PRIORITY_VALUE } from "@/lib/server/serialize-project";
import { parseDeadline } from "@/lib/server/dates";
import { notify } from "@/lib/server/notify";
import type { TaskPriority } from "@/lib/mock-data";

async function findByCode(code: string) {
  return prisma.project.findUnique({ where: { projectCode: code } });
}

// Admin always; otherwise only the project's own creator — matches
// canEditProject/isProjectOwner in lib/permissions.ts.
function isOwner(me: { id: string; role: string }, project: { createdById: string }) {
  return me.role === "ADMIN" || project.createdById === me.id;
}

// The assigned R&D owner isn't the project's "owner" (isOwner above) —
// often a different person entirely (Sales/Marketing creates it, R&D
// executes it) — but the My Task To Do List still lets them update
// their own status fields for it (priority, needs-support flag, the
// note, and now completedAt), same as they already can for an ad-hoc
// RndTask they own. Anything else (rename, reassign, deadline, brief,
// attachments) stays owner/Admin-only.
const RND_STATUS_FIELDS = ["rndPriority", "rndNeedsSupport", "rndImportantNote", "completedAt"] as const;

interface PatchBody {
  name?: string;
  rndOwner?: string | null;
  deadline?: string | null;
  brief?: string | null;
  rndPriority?: TaskPriority;
  rndNeedsSupport?: string | null;
  rndImportantNote?: string | null;
  attachments?: { fileName: string; fileUrl: string }[];
  // A manual correction from the To Do List's "Hoàn thành" column —
  // separate from POST .../complete, which stamps "now" when a project
  // is actually marked done. This just lets Admin/the owner fix the
  // recorded date after the fact (e.g. it was really finished a day
  // earlier than whoever clicked the button got around to it).
  completedAt?: string | null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const project = await findByCode(code);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: PatchBody = await request.json();
  const bodyKeys = Object.keys(body);
  const onlyRndStatusFields =
    bodyKeys.length > 0 && bodyKeys.every((k) => (RND_STATUS_FIELDS as readonly string[]).includes(k));
  const allowed = isOwner(me, project) || (onlyRndStatusFields && project.rndOwnerId === me.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data: Record<string, unknown> = {};

  if ("name" in body && body.name) data.projectName = body.name.trim();
  if ("brief" in body) data.brief = body.brief?.trim() || null;
  if ("deadline" in body) data.deadline = body.deadline && body.deadline !== "—" ? parseDeadline(body.deadline) : null;
  if ("rndPriority" in body && body.rndPriority) data.rndPriority = PRIORITY_VALUE[body.rndPriority];
  if ("rndNeedsSupport" in body) data.rndNeedsSupport = body.rndNeedsSupport || null;
  if ("rndImportantNote" in body) data.rndImportantNote = body.rndImportantNote || null;
  if ("completedAt" in body) data.completedAt = body.completedAt ? parseDeadline(body.completedAt) : null;
  // EditProjectModal sends its whole local list back (existing minus any
  // removed, plus newly-uploaded ones) — replace wholesale rather than
  // diffing, same as ProductSizeVariant's full-replace on Product PATCH.
  if ("attachments" in body) {
    const attachments = (body.attachments ?? []).filter((a) => a.fileName && a.fileUrl);
    data.attachments = {
      deleteMany: {},
      create: attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl, uploadedById: me.id })),
    };
  }

  let newRndOwnerId: string | null | undefined;
  if ("rndOwner" in body) {
    const rndOwner = body.rndOwner
      ? await prisma.user.findFirst({ where: { fullName: body.rndOwner, role: { in: ["RND", "ADMIN"] } } })
      : null;
    newRndOwnerId = rndOwner?.id ?? null;
    data.rndOwnerId = newRndOwnerId;
  }

  const updated = await prisma.project.update({ where: { id: project.id }, data, include: projectInclude() });

  // A fresh or changed R&D assignment — notify whoever it's now
  // pointed at, same as the mock's updateProject side effect.
  if (newRndOwnerId !== undefined && newRndOwnerId !== null && newRndOwnerId !== project.rndOwnerId) {
    await notify({
      userId: newRndOwnerId,
      type: "PROJECT_ASSIGNED",
      title: "Bạn được gán phụ trách dự án mới",
      message: `${updated.projectName} cần bạn xử lý.`,
      link: `/projects/${code}`,
    });
  }

  // R&D flagging "cần hỗ trợ" — pings Admin, same trigger as the mock's
  // setProjectNeedsSupport.
  if ("rndNeedsSupport" in body && body.rndNeedsSupport?.trim()) {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      await notify({
        userId: admin.id,
        type: "RND_NEEDS_SUPPORT",
        title: `${updated.projectName} cần hỗ trợ`,
        message: body.rndNeedsSupport.trim(),
        link: `/projects/${code}`,
      });
    }
  }

  // Admin writing a directive down to the project's rndOwner — same
  // trigger as the mock's setProjectImportantNote.
  if ("rndImportantNote" in body && body.rndImportantNote?.trim() && updated.rndOwnerId) {
    await notify({
      userId: updated.rndOwnerId,
      type: "ADMIN_IMPORTANT_NOTE",
      title: `Admin gửi lưu ý cho dự án ${updated.projectName}`,
      message: body.rndImportantNote.trim(),
      link: `/projects/${code}`,
    });
  }

  return NextResponse.json(serializeProject(updated));
}

// Irreversible, so re-verify ownership server-side too
// (canHardDeleteProject) — everything else here is a reversible
// status/field flip. No longer gated on status === CREATED: Admin (or
// the project's own owner) can now hard-delete a project at any stage —
// an explicit ask, not an oversight (see canHardDeleteProject's own
// comment). Cascades ProjectProduct/ProjectPhoto/Feedback rows; any
// Collection exported from this project keeps existing, just loses its
// projectId (schema-level ON DELETE SET NULL).
export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const project = await findByCode(code);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isOwner(me, project)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.project.delete({ where: { id: project.id } });
  return NextResponse.json({ ok: true });
}
