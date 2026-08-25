import type {
  ProductStatus,
  ReusePermission,
  ProjectStatus,
  UsageType,
  ProjectProductStatus,
  CustomerApproval,
  Role,
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
    REFERENCE_ONLY: { cls: "bg-slate-soft text-slate-text", label: "Reference Only" },
    EXCLUSIVE: { cls: "bg-violet-soft text-violet", label: "Exclusive" },
  };
  const m = map[reuse];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function projectStatusBadge(status: ProjectStatus) {
  const map: Record<ProjectStatus, { cls: string; label: string }> = {
    DRAFT: { cls: "bg-slate-soft text-slate-text", label: "Draft" },
    DEVELOPING: { cls: "bg-blue-soft text-blue", label: "Developing" },
    CUSTOMER_REVIEW: { cls: "bg-amber-soft text-amber", label: "Customer Review" },
    APPROVED: { cls: "bg-green-soft text-green", label: "Approved" },
    COMPLETED: { cls: "bg-teal-soft text-teal", label: "Completed" },
    CLOSED: { cls: "bg-slate-soft text-slate-text", label: "Closed" },
  };
  const m = map[status];
  return { className: `${BADGE_BASE} ${m.cls}`, label: m.label };
}

export function usageBadge(usage: UsageType) {
  return usage === "REUSE"
    ? { className: `${BADGE_BASE} bg-accent-soft text-accent-soft-text`, label: "Reuse" }
    : { className: `${BADGE_BASE} bg-slate-soft text-slate-text`, label: "New" };
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
  CUSTOMER: "bg-green",
};
