"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { PROJECTS as INITIAL_PROJECTS, type Project } from "@/lib/mock-data";

interface ProjectsContextValue {
  projects: Project[];
  updateProject: (code: string, patch: Partial<Project>) => void;
  closeProject: (code: string) => void;
  deleteProject: (code: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);

  function updateProject(code: string, patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  }

  function closeProject(code: string) {
    updateProject(code, { status: "CLOSED" });
  }

  function deleteProject(code: string) {
    setProjects((prev) => prev.filter((p) => p.code !== code));
  }

  return (
    <ProjectsContext.Provider value={{ projects, updateProject, closeProject, deleteProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
