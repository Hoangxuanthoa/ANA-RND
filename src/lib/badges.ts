import type {
  ProductStatus,
  ReusePermission,
  ProjectStatus,
  UsageType,
  ProjectProductStatus,
  CustomerApproval,
  Role,
  TaskPriority,
} from "@/lib/mock-data";

const BADGE_BASE =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap";

export function productStatusBadge(status: ProductStatus) {
  const map: Record<ProductStatus, { cls: string; label: string }> = {
    DRAFT: { cls: "bg-slate-soft text-slate-text", label: "Draft" },
    DEVELOPING: { cls: "bg-blue-soft text-blue", label: "Developing" },
    PENDING_REVIEW: { cls: "bg-amber-soft text-amber", label: "Pending Review" },
    RELEASED: { cls: "bg-accent-soft text-accent-soft-text", label: "Released" },
    ARCHIVED: { cls: "bg-slate-soft text-slate-text", label: "Archived" },
  };
  const m = map[status];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function reusePermissionBadge(reuse: ReusePermission) {
  const map: Record<ReusePermission, { cls: string; label: string }> = {
    REUSABLE: { cls: "bg-green-soft text-green", label: "Reusable" },
    EXCLUSIVE: { cls: "bg-violet-soft text-violet", label: "Exclusive" },
  };
  const m = map[reuse];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function projectStatusBadge(status: ProjectStatus) {
  const map: Record<ProjectStatus, { cls: string; label: string }> = {
    CREATED: { cls: "bg-slate-soft text-slate-text", label: "Created" },
    DEVELOPING: { cls: "bg-blue-soft text-blue", label: "Developing" },
    COMPLETED: { cls: "bg-teal-soft text-teal", label: "Completed" },
    CLOSED: { cls: "bg-slate-soft text-slate-text", label: "Closed" },
  };
  const m = map[status];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function projectTypeBadge(type: "CUSTOMER" | "INTERNAL" | "MARKETING") {
  const map: Record<string, { cls: string; label: string }> = {
    CUSTOMER: { cls: "bg-blue-soft text-blue", label: "Customer" },
    INTERNAL: { cls: "bg-slate-soft text-slate-text", label: "Nội bộ" },
    MARKETING: { cls: "bg-violet-soft text-violet", label: "Marketing" },
  };
  const m = map[type];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function usageBadge(usage: UsageType) {
  return usage === "REUSE"
    ? { className: `${BADGE_BASE} bg-accent-soft text-accent-soft-text`, label: "Reuse" }
    : { className: `${BADGE_BASE} bg-slate-soft text-slate-text`, label: "New" };
}

// A bulk-uploaded placeholder product that still needs its real name/
// category/material filled in before it can be released.
export function incompleteInfoBadge() {
  return { className: `${BADGE_BASE} bg-amber-soft text-amber`, label: "Thiếu thông tin" };
}

// R&D My Task To Do List — Trạng thái is always derived, never a stored
// toggle (see RndTask/Project.completedAt in mock-data.ts), so this just
// renders whichever of the two states was already computed.
export function taskStatusBadge(isDone: boolean) {
  return isDone
    ? { className: `${BADGE_BASE} bg-green-soft text-green`, label: "Hoàn thành" }
    : { className: `${BADGE_BASE} bg-blue-soft text-blue`, label: "Đang làm" };
}

export function taskPriorityBadge(priority: TaskPriority) {
  const map: Record<TaskPriority, { cls: string; label: string }> = {
    "Trọng tâm": { cls: "bg-red text-white", label: "Trọng tâm" },
    Cao: { cls: "bg-red-soft text-red", label: "Cao" },
    "Trung bình": { cls: "bg-amber-soft text-amber", label: "Trung bình" },
    Thấp: { cls: "bg-slate-soft text-slate-text", label: "Thấp" },
  };
  const m = map[priority];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function projectProductStatusBadge(status: ProjectProductStatus) {
  const map: Record<ProjectProductStatus, { cls: string; label: string }> = {
    DEVELOPING: { cls: "bg-blue-soft text-blue", label: "Developing" },
    SALES_REVIEW: { cls: "bg-amber-soft text-amber", label: "Sales Review" },
    CUSTOMER_REVIEW: { cls: "bg-amber-soft text-amber", label: "Customer Review" },
    APPROVED: { cls: "bg-green-soft text-green", label: "Approved" },
    REJECTED: { cls: "bg-red-soft text-red", label: "Rejected" },
    COMPLETED: { cls: "bg-teal-soft text-teal", label: "Completed" },
  };
  const m = map[status];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function customerApprovalBadge(approval: CustomerApproval) {
  const map: Record<CustomerApproval, { cls: string; label: string }> = {
    PENDING: { cls: "bg-slate-soft text-slate-text", label: "Approval: Pending" },
    CHANGE_REQUESTED: { cls: "bg-red-soft text-red", label: "Approval: Change Requested" },
    APPROVED: { cls: "bg-green-soft text-green", label: "Approval: Approved" },
  };
  const m = map[approval];
  return { className: `inline-flex items-center rounded-md px-2 py-1 text-[10.5px] font-bold ${m.cls}`, label: m.label };
}

export const TINT_BG: Record<string, string> = {
  accent: "bg-accent-soft",
  blue: "bg-blue-soft",
  green: "bg-green-soft",
  slate: "bg-slate-soft",
  amber: "bg-amber-soft",
};
export const TINT_FG: Record<string, string> = {
  accent: "text-accent-soft-text",
  blue: "text-blue",
  green: "text-green",
  slate: "text-slate-text",
  amber: "text-amber",
};
export const TINT_AVATAR_BG: Record<Role, string> = {
  ADMIN: "bg-violet",
  RND: "bg-blue",
  SALES: "bg-amber",
  MARKETING: "bg-teal",
  CUSTOMER: "bg-green",
};
