"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PROJECTS as INITIAL_PROJECTS,
  PROJECT_PRODUCTS as INITIAL_PROJECT_PRODUCTS,
  PROJECT_FEEDBACK as INITIAL_PROJECT_FEEDBACK,
  feedbackIdentity,
  CURRENT_USER_NAME,
  STAFF,
  todayDDMMYYYY,
  type Project,
  type ProjectProductItem,
  type ProjectFeedbackItem,
  type UsageType,
} from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { useNotifications } from "@/components/NotificationsProvider";
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
  // Same as addProductToProject but for a whole batch at once (bulk image
  // upload) — one state update and one notification instead of one of
  // each per product, so the creator doesn't get N separate pings for a
  // single upload action.
  addProductsToProjectBulk: (projectCode: string, productCodes: string[], usage: UsageType, assigneeName?: string) => void;
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
  // R&D flagging "cần hỗ trợ" on their My Task To Do List row for this
  // project — patches the note and pings Admin, same pattern as the
  // other notification-raising actions above (plain updateProject has no
  // side effects, so this is deliberately its own function).
  setProjectNeedsSupport: (code: string, note: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const { addNotification } = useNotifications();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [projectProducts, setProjectProducts] = useState<ProjectProductItem[]>(INITIAL_PROJECT_PRODUCTS);
  const [projectFeedback, setProjectFeedback] = useState<ProjectFeedbackItem[]>(INITIAL_PROJECT_FEEDBACK);

  function updateProject(code: string, patch: Partial<Project>) {
    const before = projects.find((p) => p.code === code);
    setProjects((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
    // A fresh or changed R&D assignment — notify whoever it's now
    // pointed at. This is the one real trigger for "task assigned" in
    // the app right now; there's no other place rndOwner gets set after
    // creation.
    if (before && patch.rndOwner && patch.rndOwner !== before.rndOwner) {
      addNotification({
        type: "PROJECT_ASSIGNED",
        title: "Bạn được gán phụ trách dự án mới",
        message: `${patch.name ?? before.name} cần bạn xử lý.`,
        link: `/projects/${code}`,
        recipientName: patch.rndOwner,
      });
    }
  }

  function closeProject(code: string) {
    updateProject(code, { status: "CLOSED" });
  }

  function markCompleted(code: string) {
    updateProject(code, { status: "COMPLETED", completedAt: todayDDMMYYYY() });
  }

  function setProjectNeedsSupport(code: string, note: string) {
    updateProject(code, { rndNeedsSupport: note });
    const trimmed = note.trim();
    if (!trimmed) return;
    const project = projects.find((p) => p.code === code);
    const admin = STAFF.find((s) => s.role === "ADMIN");
    if (!project || !admin) return;
    addNotification({
      type: "RND_NEEDS_SUPPORT",
      title: `${project.name} cần hỗ trợ`,
      message: trimmed,
      link: `/projects/${code}`,
      recipientName: admin.name,
    });
  }

  function deleteProject(code: string) {
    setProjects((prev) => prev.filter((p) => p.code !== code));
    setProjectProducts((prev) => prev.filter((pp) => pp.projectCode !== code));
  }

  function createProject(project: Project) {
    setProjects((prev) => [project, ...prev]);
    if (role === "CUSTOMER" && project.sales) {
      addNotification({
        type: "PROJECT_REQUESTED_BY_CUSTOMER",
        title: "Khách hàng vừa gửi yêu cầu dự án mới",
        message: `${project.name} — cần bạn gán R&D phụ trách.`,
        link: `/projects/${project.code}`,
        recipientName: project.sales,
      });
    }
  }

  function addProjectFeedback(projectCode: string, content: string) {
    const { author, initials, tint } = feedbackIdentity(role);
    setProjectFeedback((prev) => [...prev, { projectCode, author, content, time: "Vừa xong", initials, tint }]);
    const project = projects.find((p) => p.code === projectCode);
    const actorName = CURRENT_USER_NAME[role];
    if (project && project.createdByName !== actorName) {
      addNotification({
        type: "NEW_FEEDBACK",
        title: `Bình luận mới trong dự án ${project.name}`,
        message: content,
        link: `/projects/${projectCode}`,
        recipientName: project.createdByName,
      });
    }
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
    const project = projects.find((p) => p.code === projectCode);
    const item = projectProducts.find((pp) => pp.projectCode === projectCode && pp.productCode === productCode);
    const actorName = CURRENT_USER_NAME[role];
    const recipient =
      item?.assigneeName && item.assigneeName !== actorName
        ? item.assigneeName
        : project && project.createdByName !== actorName
          ? project.createdByName
          : undefined;
    if (recipient) {
      addNotification({
        type: "NEW_FEEDBACK",
        title: `Bình luận mới trên ${productCode}`,
        message: content,
        link: `/projects/${projectCode}`,
        recipientName: recipient,
      });
    }
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
    const project = projects.find((p) => p.code === projectCode);
    const actorName = CURRENT_USER_NAME[role];
    if (project && project.createdByName !== actorName) {
      addNotification({
        type: "PROJECT_ITEM_NEEDS_REVIEW",
        title: "Có sản phẩm mới cần bạn duyệt",
        message: `${productCode} trong dự án ${project.name}`,
        link: `/projects/${projectCode}`,
        recipientName: project.createdByName,
      });
    }
  }

  function addProductsToProjectBulk(projectCode: string, productCodes: string[], usage: UsageType, assigneeName?: string) {
    setProjectProducts((prev) => {
      const existing = new Set(prev.filter((pp) => pp.projectCode === projectCode).map((pp) => pp.productCode));
      const additions = productCodes
        .filter((code) => !existing.has(code))
        .map(
          (productCode): ProjectProductItem => ({
            projectCode,
            productCode,
            usage,
            status: "SALES_REVIEW",
            approval: "PENDING",
            note: "",
            assigneeName,
            feedback: [],
          }),
        );
      return [...prev, ...additions];
    });
    setProjects((prev) =>
      prev.map((p) => (p.code === projectCode && p.status === "CREATED" ? { ...p, status: "DEVELOPING" } : p)),
    );
    const project = projects.find((p) => p.code === projectCode);
    const actorName = CURRENT_USER_NAME[role];
    if (project && project.createdByName !== actorName && productCodes.length > 0) {
      addNotification({
        type: "PROJECT_ITEM_NEEDS_REVIEW",
        title: "Có sản phẩm mới cần bạn duyệt",
        message: `${productCodes.length} sản phẩm mới trong dự án ${project.name}`,
        link: `/projects/${projectCode}`,
        recipientName: project.createdByName,
      });
    }
  }

  function approveProjectProduct(projectCode: string, productCode: string) {
    const project = projects.find((p) => p.code === projectCode);
    const creatorRole = project ? projectCreatorRole(project) : undefined;
    const current = projectProducts.find((pp) => pp.projectCode === projectCode && pp.productCode === productCode);
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

    if (project && current) {
      if (current.status === "SALES_REVIEW" && creatorRole === "SALES" && project.customer) {
        // Moved on to the real Customer review stage — it's their turn now.
        addNotification({
          type: "PROJECT_ITEM_NEEDS_REVIEW",
          title: "Có mẫu mới cần bạn duyệt",
          message: `${productCode} trong dự án ${project.name}`,
          link: `/projects/${projectCode}`,
          recipientName: project.customer,
        });
      } else if (current.assigneeName) {
        // Either the creator approved straight to final (Admin/Marketing
        // project, no customer step) or the Customer just approved —
        // either way the assigned R&D's work just got Approved.
        addNotification({
          type: "PROJECT_ITEM_APPROVED",
          title: "Sản phẩm của bạn đã được duyệt",
          message: `${productCode} trong dự án ${project.name} đã Approved.`,
          link: `/projects/${projectCode}`,
          recipientName: current.assigneeName,
        });
      }
    }

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
    const item = projectProducts.find((pp) => pp.projectCode === projectCode && pp.productCode === productCode);
    const project = projects.find((p) => p.code === projectCode);
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode
          ? { ...pp, status: "DEVELOPING", approval: "CHANGE_REQUESTED", lastRejectionReason: reason }
          : pp,
      ),
    );
    if (item?.assigneeName && project) {
      addNotification({
        type: "PROJECT_ITEM_CHANGE_REQUESTED",
        title: `${productCode} cần chỉnh sửa`,
        message: reason,
        link: `/projects/${projectCode}`,
        recipientName: item.assigneeName,
      });
    }
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
        addProductsToProjectBulk,
        addProjectFeedback,
        addProjectProductFeedback,
        approveProjectProduct,
        rejectProjectProduct,
        resubmitProjectProduct,
        setProjectNeedsSupport,
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
