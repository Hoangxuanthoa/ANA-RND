"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RndTask, TaskCategory, TaskPriority } from "@/lib/mock-data";

interface RndTasksContextValue {
  rndTasks: RndTask[];
  addTask: (input: {
    title: string;
    category: TaskCategory;
    priority: TaskPriority;
    requester: string;
    startDate: string;
    deadline: string;
  }) => Promise<void>;
  updateTask: (id: string, patch: Partial<RndTask>) => void;
  deleteTask: (id: string) => void;
  // Same "own function, not a plain patch" reasoning as
  // ProjectsProvider.setProjectNeedsSupport — this one also notifies Admin.
  setTaskNeedsSupport: (id: string, note: string) => void;
  // Opposite direction: Admin writing a directive down to the task's
  // owner. Only my-tasks/page.tsx's isAdmin gate ever calls this.
  setTaskImportantNote: (id: string, note: string) => void;
}

const RndTasksContext = createContext<RndTasksContextValue | null>(null);

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

export function RndTasksProvider({ children }: { children: ReactNode }) {
  const [rndTasks, setRndTasks] = useState<RndTask[]>([]);

  useEffect(() => {
    fetch("/api/rnd-tasks")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRndTasks);
  }, []);

  function replaceTask(id: string, updated: RndTask) {
    setRndTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function addTask(input: {
    title: string;
    category: TaskCategory;
    priority: TaskPriority;
    requester: string;
    startDate: string;
    deadline: string;
  }) {
    const created = await postJson<RndTask>("/api/rnd-tasks", input);
    setRndTasks((prev) => [created, ...prev]);
  }

  function updateTask(id: string, patch: Partial<RndTask>) {
    setRndTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    postJson<RndTask>(`/api/rnd-tasks/${id}`, patch, "PATCH").then((t) => replaceTask(id, t)).catch(() => {});
  }

  function deleteTask(id: string) {
    setRndTasks((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/rnd-tasks/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function setTaskNeedsSupport(id: string, note: string) {
    updateTask(id, { needsSupport: note });
  }

  function setTaskImportantNote(id: string, note: string) {
    updateTask(id, { importantNote: note });
  }

  return (
    <RndTasksContext.Provider
      value={{ rndTasks, addTask, updateTask, deleteTask, setTaskNeedsSupport, setTaskImportantNote }}
    >
      {children}
    </RndTasksContext.Provider>
  );
}

export function useRndTasks() {
  const ctx = useContext(RndTasksContext);
  if (!ctx) throw new Error("useRndTasks must be used within RndTasksProvider");
  return ctx;
}
