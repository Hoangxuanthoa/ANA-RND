import { STAFF, type Role, type Project, type ProjectType, type Product, type Collection } from "@/lib/mock-data";

export const canViewLibrary = (role: Role) => role !== "CUSTOMER";
export const canCreateProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canManageProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canPickProduct = (role: Role) => role !== "CUSTOMER";
export const isCustomer = (role: Role) => role === "CUSTOMER";
export const canReviewProducts = (role: Role) => role === "ADMIN";

// "Việc của tôi" — a personal queue of ProjectProduct items assigned to
// this specific R&D person, distinct from the project's overall rndOwner.
export const canViewMyTasks = (role: Role) => role === "RND";

export const canManageSettings = (role: Role) => role === "ADMIN";
// Collections are for assembling a set of designs to share — R&D included,
// same as everyone else who isn't the Customer being shared with.
export const canManageCollections = (role: Role) => role !== "CUSTOMER";

// Which DRAFT collections show up when adding a product to one — same
// ownership scoping as getPickableProjects: Admin sees every draft,
// everyone else only the ones they created.
export function getPickableCollections<T extends Collection>(role: Role, userName: string, collections: T[]): T[] {
  const drafts = collections.filter((c) => c.status === "DRAFT");
  if (role === "ADMIN") return drafts;
  return drafts.filter((c) => c.createdByName === userName);
}

export function canEditCollection(role: Role, userName: string, collection: Collection) {
  return collection.status === "DRAFT" && (role === "ADMIN" || collection.createdByName === userName);
}

// "My Collection" tab filter — same shape as isMyProject, but Collections
// have no role-specific notion of "mine" like R&D's rndOwner, so it's
// just who created it.
export function isMyCollection(userName: string, collection: Collection) {
  return collection.createdByName === userName;
}

// Library visibility has exactly two sources of a product, and they're
// treated differently:
// - Project-origin work (has any ProjectProductItem link at all) stays
//   out of the Library entirely — for every role, Admin included — until
//   it's actually Released. It "lives" in its project until then.
// - A standalone direct R&D upload is visible early since there's no
//   project page for it to live in instead: Admin sees all of it, R&D
//   sees their own DRAFT/DEVELOPING (not a colleague's work-in-progress)
//   plus everyone's PENDING_REVIEW (that queue is team-visible, same as
//   the "Duyệt sản phẩm" badge). Sales/Marketing/Customer never see it
//   before it's Released either way.
export function canSeeProductInLibrary(role: Role, userName: string, product: Product, hasProjectOrigin: boolean) {
  if (product.status === "RELEASED") return true;
  if (hasProjectOrigin) return false;
  if (role === "ADMIN") return true;
  if (role === "RND") {
    if (product.status === "DRAFT" || product.status === "DEVELOPING") {
      return product.designer.startsWith(userName);
    }
    return true;
  }
  return false;
}

// Only Sales (or Admin) marks a design Exclusive — and only on a NEW
// design still inside the project that produced it. A picked/REUSE
// product or a standalone R&D upload is never eligible (see the "Gắn
// Exclusive" button gating in the project detail page).
export const canSetExclusive = (role: Role) => role === "SALES" || role === "ADMIN";

// Edit/Delete a product: Admin can touch any of them; R&D only their own
// uploads, not a colleague's.
export function canEditProduct(role: Role, userName: string, product: Product) {
  if (role === "ADMIN") return true;
  return role === "RND" && product.designer.startsWith(userName);
}

// A DRAFT that's never been picked into any project can be permanently
// deleted — same "no activity yet" rule as canHardDeleteProject. Anything
// with history (released, used in a project) only gets archived so the
// reuse/usage records it's tied to stay valid.
export function canHardDeleteProduct(product: Product, usageCount: number) {
  return product.status === "DRAFT" && usageCount === 0;
}

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

// "My Project" tab filter on the Projects list — deliberately different
// from isProjectOwner (no Admin-always-true bypass, since here "mine"
// should mean literally created-by-me for Admin too). R&D's notion of
// "mine" is different from everyone else's: they don't create projects,
// they're assigned to them as rndOwner.
export function isMyProject(role: Role, userName: string, project: Project) {
  if (role === "RND") return project.rndOwner === userName;
  return project.createdByName === userName;
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
// has completed (all its products approved internally) — releasing
// mid-project would show an unfinished engagement's work to everyone
// else. Release happens before the project is Closed, not after.
export function canReleaseToLibrary(role: Role, userName: string, project: Project) {
  return project.status === "COMPLETED" && isAssignedRndOwner(role, userName, project);
}

// Who created a project, by role — looked up from the staff roster since
// Project only stores the creator's name. Used to decide the internal
// review path for that project's products (see canReviewAsCreator).
export function projectCreatorRole(project: Project): Role | undefined {
  return STAFF.find((s) => s.name === project.createdByName)?.role;
}

// The first review stage for anything added to a project is always the
// project's own creator — Sales, Marketing, or Admin, whoever it was —
// plus Admin as universal oversight. Only when the creator is Sales does
// the item go on to a real Customer review after this; Admin/Marketing
// projects have no external customer, so the creator's approval is final.
export function canReviewAsCreator(role: Role, userName: string, project: Project) {
  return role === "ADMIN" || project.createdByName === userName;
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
