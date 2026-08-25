import type { Role, Project } from "@/lib/mock-data";

export const canViewLibrary = (role: Role) => role !== "CUSTOMER";
export const canCreateProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canManageProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canCreateProject = (role: Role) => role !== "CUSTOMER";
export const canPickProduct = (role: Role) => role !== "CUSTOMER";
export const isCustomer = (role: Role) => role === "CUSTOMER";

// Ownership: Admin can touch any project; a Sales rep can only edit/close/
// delete the projects where they are the assigned `sales` — not a colleague's.
export function isProjectOwner(role: Role, userName: string, project: Project) {
  if (role === "ADMIN") return true;
  return role === "SALES" && project.sales === userName;
}

export function canEditProject(role: Role, userName: string, project: Project) {
  return isProjectOwner(role, userName, project);
}

// A project with no real activity yet (still DRAFT) can be permanently
// deleted. Anything past that only gets closed, so the reuse/approval
// stats computed from ProjectProduct/Feedback/Activity stay correct.
export const canHardDeleteProject = (project: Project) => project.status === "DRAFT";

export function canRemoveProject(role: Role, userName: string, project: Project) {
  return isProjectOwner(role, userName, project);
}

// Product-development actions inside a project (upload version, release)
// are scoped to the assigned R&D owner — not just "any R&D".
export function isAssignedRndOwner(role: Role, userName: string, project: Project) {
  if (role === "ADMIN") return true;
  return role === "RND" && project.rndOwner === userName;
}
