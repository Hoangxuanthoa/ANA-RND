"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PROJECTS as INITIAL_PROJECTS,
  PROJECT_PRODUCTS as INITIAL_PROJECT_PRODUCTS,
  PROJECT_FEEDBACK as INITIAL_PROJECT_FEEDBACK,
  feedbackIdentity,
  type Project,
  type ProjectProductItem,
  type ProjectFeedbackItem,
  type UsageType,
} from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { projectCreatorRole } from "@/lib/permissions";

interface ProjectsContextValue {
  projects: Project[];
  projectProducts: ProjectProductItem[];
  projectFeedback: ProjectFeedbackItem[];
  updateProject: (code: string, patch: Partial<Project>) => void;
  closeProject: (code: string) => void;
  markCompleted: (code: string) => void;
  deleteProject: (code: string) => void;
  createProject: (project: Project) => void;
  // Picking a product into a project (from the Library) or R&D adding a
  // freshly-designed one — either way this is what auto-bumps a project
  // out of "Created" the moment it gets its first product, and both go
  // straight into the project's own internal review queue (no holding
  // "Developing" stage — that status is only ever re-entered after a
  // rejection sends something back for rework).
  addProductToProject: (projectCode: string, productCode: string, usage: UsageType, assigneeName?: string) => void;
  addProjectFeedback: (projectCode: string, content: string) => void;
  addProjectProductFeedback: (projectCode: string, productCode: string, content: string) => void;
  // Advances one item through its project's internal review: from the
  // creator's own review to either Customer review (creator is Sales) or
  // straight to Approved (creator is Admin/Marketing, no real customer to
  // ask), or from Customer review to Approved. Auto-completes the project
  // once every one of its items is Approved.
  approveProjectProduct: (projectCode: string, productCode: string) => void;
  // Sends an item back to Developing from whichever review stage it was
  // at, recording why so R&D can see it (and dispute it via the item's
  // own feedback thread) before resubmitting.
  rejectProjectProduct: (projectCode: string, productCode: string, reason: string) => void;
  // Puts a Developing (rejected) item back at the very first review
  // stage — always the creator's, even if it was a Customer rejection —
  // so the creator sees the fix before it goes to the customer again.
  resubmitProjectProduct: (projectCode: string, productCode: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [projectProducts, setProjectProducts] = useState<ProjectProductItem[]>(INITIAL_PROJECT_PRODUCTS);
  const [projectFeedback, setProjectFeedback] = useState<ProjectFeedbackItem[]>(INITIAL_PROJECT_FEEDBACK);

  function updateProject(code: string, patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  }

  function closeProject(code: string) {
    updateProject(code, { status: "CLOSED" });
  }

  function markCompleted(code: string) {
    updateProject(code, { status: "COMPLETED" });
  }

  function deleteProject(code: string) {
    setProjects((prev) => prev.filter((p) => p.code !== code));
    setProjectProducts((prev) => prev.filter((pp) => pp.projectCode !== code));
  }

  function createProject(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  function addProjectFeedback(projectCode: string, content: string) {
    const { author, initials, tint } = feedbackIdentity(role);
    setProjectFeedback((prev) => [...prev, { projectCode, author, content, time: "Vừa xong", initials, tint }]);
  }

  function addProjectProductFeedback(projectCode: string, productCode: string, content: string) {
    const { author, initials, tint } = feedbackIdentity(role);
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode
          ? { ...pp, feedback: [...pp.feedback, { author, content, time: "Vừa xong", initials, tint }] }
          : pp,
      ),
    );
  }

  function addProductToProject(projectCode: string, productCode: string, usage: UsageType, assigneeName?: string) {
    setProjectProducts((prev) => {
      if (prev.some((pp) => pp.projectCode === projectCode && pp.productCode === productCode)) {
        return prev;
      }
      return [
        ...prev,
        {
          projectCode,
          productCode,
          usage,
          status: "SALES_REVIEW",
          approval: "PENDING",
          note: "",
          assigneeName,
          feedback: [],
        },
      ];
    });
    setProjects((prev) =>
      prev.map((p) => (p.code === projectCode && p.status === "CREATED" ? { ...p, status: "DEVELOPING" } : p)),
    );
  }

  function approveProjectProduct(projectCode: string, productCode: string) {
    const project = projects.find((p) => p.code === projectCode);
    const creatorRole = project ? projectCreatorRole(project) : undefined;
    const updated = projectProducts.map((pp): ProjectProductItem => {
      if (pp.projectCode !== projectCode || pp.productCode !== productCode) return pp;
      if (pp.status === "SALES_REVIEW") {
        const nextStatus = creatorRole === "SALES" ? "CUSTOMER_REVIEW" : "APPROVED";
        return { ...pp, status: nextStatus, approval: nextStatus === "APPROVED" ? "APPROVED" : "PENDING" };
      }
      if (pp.status === "CUSTOMER_REVIEW") {
        return { ...pp, status: "APPROVED", approval: "APPROVED" };
      }
      return pp;
    });
    setProjectProducts(updated);

    // Auto-complete the moment every item in the project is Approved —
    // the manual "Đánh dấu Hoàn thành" button still works too, for the
    // edge case of wrapping up despite one stuck item.
    const projectItems = updated.filter((pp) => pp.projectCode === projectCode);
    if (
      project &&
      project.status === "DEVELOPING" &&
      projectItems.length > 0 &&
      projectItems.every((pp) => pp.status === "APPROVED")
    ) {
      updateProject(projectCode, { status: "COMPLETED" });
    }
  }

  function rejectProjectProduct(projectCode: string, productCode: string, reason: string) {
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode
          ? { ...pp, status: "DEVELOPING", approval: "CHANGE_REQUESTED", lastRejectionReason: reason }
          : pp,
      ),
    );
  }

  function resubmitProjectProduct(projectCode: string, productCode: string) {
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode
          ? { ...pp, status: "SALES_REVIEW", approval: "PENDING", lastRejectionReason: undefined }
          : pp,
      ),
    );
  }

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        projectProducts,
        projectFeedback,
        updateProject,
        closeProject,
        markCompleted,
        deleteProject,
        createProject,
        addProductToProject,
        addProjectFeedback,
        addProjectProductFeedback,
        approveProjectProduct,
        rejectProjectProduct,
        resubmitProjectProduct,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
