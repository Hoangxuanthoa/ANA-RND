"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Project, ProjectProductItem, ProjectFeedbackItem, UsageType, ProjectType } from "@/lib/mock-data";
import { useStaff } from "@/components/StaffProvider";
import { projectCreatorRole } from "@/lib/permissions";

interface ProjectsContextValue {
  // False until the initial GET /api/projects resolves — see
  // ProductsProvider's productsLoaded for why a detail page needs this
  // (projects/[code]/page.tsx must wait for it before concluding
  // "not found").
  projectsLoaded: boolean;
  projects: Project[];
  projectProducts: ProjectProductItem[];
  projectFeedback: ProjectFeedbackItem[];
  updateProject: (code: string, patch: Partial<Project>) => void;
  closeProject: (code: string) => void;
  reopenProject: (code: string) => Promise<void>;
  markCompleted: (code: string) => void;
  deleteProject: (code: string) => void;
  createProject: (input: {
    name: string;
    type: ProjectType;
    customer?: string;
    sales?: string;
    rndOwner?: string;
    deadline: string;
    brief: string;
  }) => Promise<string>;
  addProductToProject: (projectCode: string, productCode: string, usage: UsageType, assigneeName?: string) => void;
  addProductsToProjectBulk: (projectCode: string, productCodes: string[], usage: UsageType, assigneeName?: string) => void;
  removeProjectProduct: (projectCode: string, productCode: string) => void;
  addProjectFeedback: (projectCode: string, content: string) => void;
  addProjectProductFeedback: (projectCode: string, productCode: string, content: string) => void;
  approveProjectProduct: (projectCode: string, productCode: string) => void;
  rejectProjectProduct: (projectCode: string, productCode: string, reason: string) => void;
  resubmitProjectProduct: (projectCode: string, productCode: string) => void;
  setProjectNeedsSupport: (code: string, note: string) => void;
  setProjectImportantNote: (code: string, note: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const JSON_HEADERS = { "Content-Type": "application/json" };

function bodyWithNulls(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v === undefined ? null : v));
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: JSON_HEADERS, body: bodyWithNulls(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Thao tác thất bại — thử lại.");
  return data as T;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { staff } = useStaff();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectProducts, setProjectProducts] = useState<ProjectProductItem[]>([]);
  const [projectFeedback, setProjectFeedback] = useState<ProjectFeedbackItem[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProjects)
      .finally(() => setProjectsLoaded(true));
    fetch("/api/projects/feedback")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProjectFeedback);
    Promise.all([
      fetch("/api/projects/products").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/projects/products/feedback").then((res) => (res.ok ? res.json() : [])),
    ]).then(([items, feedbackRows]: [Omit<ProjectProductItem, "feedback">[], (ProjectFeedbackItem & { productCode: string })[]]) => {
      setProjectProducts(
        items.map((item) => ({
          ...item,
          feedback: feedbackRows.filter((f) => f.projectCode === item.projectCode && f.productCode === item.productCode),
        })),
      );
    });
  }, []);

  function replaceProject(code: string, updated: Project) {
    setProjects((prev) => prev.map((p) => (p.code === code ? updated : p)));
  }

  // Reconciles with the server's response for a status-transition route,
  // which never carries `.feedback` (that's fetched/appended separately)
  // — keep whatever's already in local state for it.
  function replaceProjectProductPreservingFeedback(projectCode: string, productCode: string, updated: Omit<ProjectProductItem, "feedback">) {
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode ? { ...updated, feedback: pp.feedback } : pp,
      ),
    );
  }

  function updateProject(code: string, patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
    postJson<Project>(`/api/projects/${code}`, patch, "PATCH").then((p) => replaceProject(code, p)).catch(() => {});
  }

  function closeProject(code: string) {
    setProjects((prev) => prev.map((p) => (p.code === code ? { ...p, status: "CLOSED" } : p)));
    postJson<Project>(`/api/projects/${code}/close`, {}).then((p) => replaceProject(code, p)).catch(() => {});
  }

  // No optimistic guess here — unlike close/complete, the resulting
  // status depends on the project's own product completion (computed
  // server-side, see the reopen route), not a fixed known value.
  async function reopenProject(code: string) {
    const updated = await postJson<Project>(`/api/projects/${code}/reopen`, {});
    replaceProject(code, updated);
  }

  function markCompleted(code: string) {
    setProjects((prev) => prev.map((p) => (p.code === code ? { ...p, status: "COMPLETED" } : p)));
    postJson<Project>(`/api/projects/${code}/complete`, {}).then((p) => replaceProject(code, p)).catch(() => {});
  }

  function setProjectNeedsSupport(code: string, note: string) {
    updateProject(code, { rndNeedsSupport: note });
  }

  function setProjectImportantNote(code: string, note: string) {
    updateProject(code, { rndImportantNote: note });
  }

  function deleteProject(code: string) {
    setProjects((prev) => prev.filter((p) => p.code !== code));
    setProjectProducts((prev) => prev.filter((pp) => pp.projectCode !== code));
    fetch(`/api/projects/${code}`, { method: "DELETE" }).catch(() => {});
  }

  async function createProject(input: {
    name: string;
    type: ProjectType;
    customer?: string;
    sales?: string;
    rndOwner?: string;
    deadline: string;
    brief: string;
  }): Promise<string> {
    const created = await postJson<Project>("/api/projects", input);
    setProjects((prev) => [created, ...prev]);
    return created.code;
  }

  function addProjectFeedback(projectCode: string, content: string) {
    postJson<ProjectFeedbackItem>(`/api/projects/${projectCode}/feedback`, { content })
      .then((entry) => setProjectFeedback((prev) => [...prev, entry]))
      .catch(() => {});
  }

  function addProjectProductFeedback(projectCode: string, productCode: string, content: string) {
    postJson<ProjectFeedbackItem & { productCode: string }>(
      `/api/projects/${projectCode}/products/${productCode}/feedback`,
      { content },
    )
      .then((entry) =>
        setProjectProducts((prev) =>
          prev.map((pp) =>
            pp.projectCode === projectCode && pp.productCode === productCode
              ? { ...pp, feedback: [...pp.feedback, entry] }
              : pp,
          ),
        ),
      )
      .catch(() => {});
  }

  function addProductToProject(projectCode: string, productCode: string, usage: UsageType, assigneeName?: string) {
    if (projectProducts.some((pp) => pp.projectCode === projectCode && pp.productCode === productCode)) return;
    setProjectProducts((prev) => [
      ...prev,
      { projectCode, productCode, usage, status: "SALES_REVIEW", approval: "PENDING", note: "", assigneeName, feedback: [] },
    ]);
    setProjects((prev) => prev.map((p) => (p.code === projectCode && p.status === "CREATED" ? { ...p, status: "DEVELOPING" } : p)));
    postJson<ProjectProductItem>(`/api/projects/${projectCode}/products`, { productCode, usage, assigneeName })
      .then((created) => replaceProjectProductPreservingFeedback(projectCode, productCode, created))
      .catch(() => {});
  }

  function addProductsToProjectBulk(projectCode: string, productCodes: string[], usage: UsageType, assigneeName?: string) {
    const existing = new Set(projectProducts.filter((pp) => pp.projectCode === projectCode).map((pp) => pp.productCode));
    const additions = productCodes
      .filter((code) => !existing.has(code))
      .map((productCode): ProjectProductItem => ({ projectCode, productCode, usage, status: "SALES_REVIEW", approval: "PENDING", note: "", assigneeName, feedback: [] }));
    setProjectProducts((prev) => [...prev, ...additions]);
    setProjects((prev) => prev.map((p) => (p.code === projectCode && p.status === "CREATED" ? { ...p, status: "DEVELOPING" } : p)));
    postJson<ProjectProductItem[]>(`/api/projects/${projectCode}/products/bulk`, { productCodes, usage, assigneeName }).catch(() => {});
  }

  function removeProjectProduct(projectCode: string, productCode: string) {
    setProjectProducts((prev) => prev.filter((pp) => !(pp.projectCode === projectCode && pp.productCode === productCode)));
    fetch(`/api/projects/${projectCode}/products/${productCode}`, { method: "DELETE" }).catch(() => {});
  }

  function approveProjectProduct(projectCode: string, productCode: string) {
    const project = projects.find((p) => p.code === projectCode);
    const creatorRole = project ? projectCreatorRole(project, staff) : undefined;
    setProjectProducts((prev) =>
      prev.map((pp): ProjectProductItem => {
        if (pp.projectCode !== projectCode || pp.productCode !== productCode) return pp;
        if (pp.status === "SALES_REVIEW") {
          const nextStatus = creatorRole === "SALES" ? "CUSTOMER_REVIEW" : "APPROVED";
          return { ...pp, status: nextStatus, approval: nextStatus === "APPROVED" ? "APPROVED" : "PENDING" };
        }
        if (pp.status === "CUSTOMER_REVIEW") return { ...pp, status: "APPROVED", approval: "APPROVED" };
        return pp;
      }),
    );
    // Mirrors the server's own auto-complete check — see approve route.
    if (project?.status === "DEVELOPING") {
      const items = projectProducts
        .filter((pp) => pp.projectCode === projectCode)
        .map((pp) => (pp.productCode === productCode ? { ...pp, status: pp.status === "SALES_REVIEW" ? (creatorRole === "SALES" ? "CUSTOMER_REVIEW" : "APPROVED") : "APPROVED" } : pp));
      if (items.length > 0 && items.every((pp) => pp.status === "APPROVED")) {
        setProjects((prev) => prev.map((p) => (p.code === projectCode ? { ...p, status: "COMPLETED" } : p)));
      }
    }
    postJson<Omit<ProjectProductItem, "feedback">>(`/api/projects/${projectCode}/products/${productCode}/approve`, {})
      .then((updated) => replaceProjectProductPreservingFeedback(projectCode, productCode, updated))
      .catch(() => {});
  }

  function rejectProjectProduct(projectCode: string, productCode: string, reason: string) {
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode
          ? { ...pp, status: "DEVELOPING", approval: "CHANGE_REQUESTED", lastRejectionReason: reason }
          : pp,
      ),
    );
    postJson<Omit<ProjectProductItem, "feedback">>(`/api/projects/${projectCode}/products/${productCode}/reject`, { reason })
      .then((updated) => replaceProjectProductPreservingFeedback(projectCode, productCode, updated))
      .catch(() => {});
  }

  function resubmitProjectProduct(projectCode: string, productCode: string) {
    setProjectProducts((prev) =>
      prev.map((pp) =>
        pp.projectCode === projectCode && pp.productCode === productCode
          ? { ...pp, status: "SALES_REVIEW", approval: "PENDING", lastRejectionReason: undefined }
          : pp,
      ),
    );
    postJson<Omit<ProjectProductItem, "feedback">>(`/api/projects/${projectCode}/products/${productCode}/resubmit`, {})
      .then((updated) => replaceProjectProductPreservingFeedback(projectCode, productCode, updated))
      .catch(() => {});
  }

  return (
    <ProjectsContext.Provider
      value={{
        projectsLoaded,
        projects,
        projectProducts,
        projectFeedback,
        updateProject,
        closeProject,
        reopenProject,
        markCompleted,
        deleteProject,
        createProject,
        addProductToProject,
        addProductsToProjectBulk,
        removeProjectProduct,
        addProjectFeedback,
        addProjectProductFeedback,
        approveProjectProduct,
        rejectProjectProduct,
        resubmitProjectProduct,
        setProjectNeedsSupport,
        setProjectImportantNote,
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
