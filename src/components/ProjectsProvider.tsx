"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PROJECTS as INITIAL_PROJECTS,
  PROJECT_PRODUCTS as INITIAL_PROJECT_PRODUCTS,
  type Project,
  type ProjectProductItem,
  type UsageType,
} from "@/lib/mock-data";

interface ProjectsContextValue {
  projects: Project[];
  projectProducts: ProjectProductItem[];
  updateProject: (code: string, patch: Partial<Project>) => void;
  closeProject: (code: string) => void;
  markCompleted: (code: string) => void;
  deleteProject: (code: string) => void;
  // Picking a product into a project (from the Library) or R&D adding a
  // freshly-designed one — either way this is what auto-bumps a project
  // out of "Created" the moment it gets its first product.
  addProductToProject: (projectCode: string, productCode: string, usage: UsageType) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [projectProducts, setProjectProducts] = useState<ProjectProductItem[]>(INITIAL_PROJECT_PRODUCTS);

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

  function addProductToProject(projectCode: string, productCode: string, usage: UsageType) {
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
        updateProject,
        closeProject,
        markCompleted,
        deleteProject,
        addProductToProject,
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
