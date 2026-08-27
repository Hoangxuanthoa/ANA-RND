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
  // out of "Created" the moment it gets its first product.
  addProductToProject: (projectCode: string, productCode: string, usage: UsageType, assigneeName?: string) => void;
  addProjectFeedback: (projectCode: string, content: string) => void;
  addProjectProductFeedback: (projectCode: string, productCode: string, content: string) => void;
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
          status: "DEVELOPING",
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
