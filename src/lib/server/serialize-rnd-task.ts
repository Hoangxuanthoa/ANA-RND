import type { Prisma, TaskCategory as PrismaTaskCategory } from "@prisma/client";
import { formatDDMMYYYY, type TaskCategory } from "@/lib/mock-data";
import { PRIORITY_LABEL } from "@/lib/server/serialize-project";

export const CATEGORY_LABEL: Record<PrismaTaskCategory, TaskCategory> = {
  DESIGN_3D: "Thiết kế 3D",
  DRAWING: "Bản vẽ",
  PRICING_SUPPORT: "Hỗ trợ tính giá",
  OTHER: "Khác",
};
export const CATEGORY_VALUE: Record<TaskCategory, PrismaTaskCategory> = {
  "Thiết kế 3D": "DESIGN_3D",
  "Bản vẽ": "DRAWING",
  "Hỗ trợ tính giá": "PRICING_SUPPORT",
  Khác: "OTHER",
};

export function rndTaskInclude() {
  return {
    owner: { select: { fullName: true } },
    requester: { select: { fullName: true } },
  } satisfies Prisma.RndTaskInclude;
}

type RndTaskWithRelations = Prisma.RndTaskGetPayload<{ include: ReturnType<typeof rndTaskInclude> }>;

export function serializeRndTask(t: RndTaskWithRelations) {
  return {
    id: t.id,
    ownerName: t.owner.fullName,
    title: t.title,
    category: CATEGORY_LABEL[t.category],
    priority: PRIORITY_LABEL[t.priority],
    requester: t.requester?.fullName ?? "—",
    startDate: t.startDate ? formatDDMMYYYY(t.startDate) : "—",
    deadline: t.deadline ? formatDDMMYYYY(t.deadline) : "—",
    completedAt: t.completedAt ? formatDDMMYYYY(t.completedAt) : undefined,
    needsSupport: t.needsSupport ?? undefined,
    importantNote: t.importantNote ?? undefined,
  };
}
