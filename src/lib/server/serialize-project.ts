import type { Prisma, TaskPriority as PrismaTaskPriority } from "@prisma/client";
import { formatDDMMYYYY, type TaskPriority } from "@/lib/mock-data";

// Mock data's TaskPriority is the Vietnamese label itself (shared by
// Project.rndPriority and RndTask.priority — see my-tasks/page.tsx);
// the schema enum is English. Same order both sides, so this is a
// straight positional mapping — used here for Project, and will be
// reused as-is once RndTask goes real.
export const PRIORITY_LABEL: Record<PrismaTaskPriority, TaskPriority> = {
  FOCUS: "Trọng tâm",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};
export const PRIORITY_VALUE: Record<TaskPriority, PrismaTaskPriority> = {
  "Trọng tâm": "FOCUS",
  Cao: "HIGH",
  "Trung bình": "MEDIUM",
  Thấp: "LOW",
};

export function projectInclude() {
  return {
    customer: { select: { name: true } },
    sales: { select: { fullName: true } },
    rndOwner: { select: { fullName: true } },
    createdBy: { select: { fullName: true } },
    attachments: { select: { fileName: true, fileUrl: true }, orderBy: { createdAt: "asc" } },
  } satisfies Prisma.ProjectInclude;
}

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: ReturnType<typeof projectInclude> }>;

export function serializeProject(p: ProjectWithRelations) {
  return {
    code: p.projectCode,
    name: p.projectName,
    type: p.type,
    customer: p.customer?.name,
    sales: p.sales?.fullName,
    rndOwner: p.rndOwner?.fullName,
    createdByName: p.createdBy.fullName,
    createdAt: formatDDMMYYYY(p.createdAt),
    status: p.status,
    deadline: p.deadline ? formatDDMMYYYY(p.deadline) : "—",
    brief: p.brief ?? "",
    attachments: p.attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl })),
    completedAt: p.completedAt ? formatDDMMYYYY(p.completedAt) : undefined,
    rndPriority: PRIORITY_LABEL[p.rndPriority],
    rndImportantNote: p.rndImportantNote ?? undefined,
    rndNeedsSupport: p.rndNeedsSupport ?? undefined,
  };
}

export function projectProductInclude() {
  return {
    assignee: { select: { fullName: true } },
  } satisfies Prisma.ProjectProductInclude;
}

type ProjectProductWithRelations = Prisma.ProjectProductGetPayload<{ include: ReturnType<typeof projectProductInclude> }> & {
  project: { projectCode: string };
  product: { productCode: string };
};

export function serializeProjectProduct(pp: ProjectProductWithRelations) {
  return {
    projectCode: pp.project.projectCode,
    productCode: pp.product.productCode,
    usage: pp.usageType,
    status: pp.status,
    approval: pp.customerApproval,
    note: pp.modificationNote ?? "",
    assigneeName: pp.assignee?.fullName,
    lastRejectionReason: pp.lastRejectionReason ?? undefined,
  };
}
