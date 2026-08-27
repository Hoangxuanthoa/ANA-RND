import type { Role, Project, ProjectType, Product } from "@/lib/mock-data";

export const canViewLibrary = (role: Role) => role !== "CUSTOMER";
export const canCreateProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canManageProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canPickProduct = (role: Role) => role !== "CUSTOMER";
export const isCustomer = (role: Role) => role === "CUSTOMER";
export const canReviewProducts = (role: Role) => role === "ADMIN";

// Library visibility: Sales/Marketing only ever see Released products —
// they shouldn't be offering a customer something not yet approved.
// Admin sees everything. R&D sees everything RELEASED/PENDING_REVIEW
// (that queue is team-visible), plus their OWN unsubmitted DRAFT/
// DEVELOPING work — not a colleague's work-in-progress.
export function canSeeProductInLibrary(role: Role, userName: string, product: Product) {
  if (role === "ADMIN") return true;
  if (role === "RND") {
    if (product.status === "DRAFT" || product.status === "DEVELOPING") {
      return product.designer.startsWith(userName);
    }
    return true;
  }
  return product.status === "RELEASED";
}

// Only Sales (or Admin) marks a design Exclusive to one customer — and
// only while it's still inside that customer's project, before release.
export const canSetExclusive = (role: Role) => role === "SALES" || role === "ADMIN";

// Which Project types a role is allowed to create. R&D creates none —
// they receive and work projects, never originate them.
export function creatableProjectTypes(role: Role): ProjectType[] {
  if (role === "ADMIN") return ["CUSTOMER", "INTERNAL", "MARKETING"];
  if (role === "SALES") return ["CUSTOMER"];
  if (role === "MARKETING") return ["MARKETING", "CUSTOMER"];
  return [];
}
export const canCreateProject = (role: Role) => creatableProjectTypes(role).length > 0;

// Ownership: Admin can touch any project; anyone else only the ones they
// actually created (Sales or Marketing — whoever it was, not assumed to
// be Sales, since internal/marketing projects have no Sales rep at all).
export function isProjectOwner(role: Role, userName: string, project: Project) {
  if (role === "ADMIN") return true;
  return project.createdByName === userName;
}

export function canEditProject(role: Role, userName: string, project: Project) {
  return isProjectOwner(role, userName, project);
}

export function canMarkCompleted(role: Role, userName: string, project: Project) {
  return isProjectOwner(role, userName, project);
}

// A project with no real activity yet (still Created) can be permanently
// deleted. Anything past that only gets closed, so the reuse/approval
// stats computed from ProjectProduct/Feedback/Activity stay correct.
export const canHardDeleteProject = (project: Project) => project.status === "CREATED";

export function canRemoveProject(role: Role, userName: string, project: Project) {
  return isProjectOwner(role, userName, project);
}

// Product-development actions inside a project (upload version, release
// to library) are scoped to the assigned R&D owner — not just "any R&D".
export function isAssignedRndOwner(role: Role, userName: string, project: Project) {
  if (role === "ADMIN") return true;
  return role === "RND" && project.rndOwner === userName;
}

// A design can only be released to the general library once its project
// has actually closed — releasing mid-project would show an unfinished
// engagement's work to everyone else.
export function canReleaseToLibrary(role: Role, userName: string, project: Project) {
  return project.status === "CLOSED" && isAssignedRndOwner(role, userName, project);
}

// Which projects show up when picking one to add a library product to —
// scoped by who you are, not just "any project you can see".
export function getPickableProjects<T extends Project>(role: Role, userName: string, projects: T[]): T[] {
  const open = projects.filter((p) => p.status === "CREATED" || p.status === "DEVELOPING");
  if (role === "ADMIN") return open;
  if (role === "SALES" || role === "MARKETING") {
    return open.filter((p) => p.createdByName === userName);
  }
  if (role === "RND") {
    return open.filter((p) => p.rndOwner === userName);
  }
  return [];
}
