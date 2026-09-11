"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { INITIAL_RND_TASKS, STAFF, type RndTask, type TaskCategory, type TaskPriority } from "@/lib/mock-data";
import { useNotifications } from "@/components/NotificationsProvider";

interface RndTasksContextValue {
  rndTasks: RndTask[];
  addTask: (input: {
    ownerName: string;
    title: string;
    category: TaskCategory;
    priority: TaskPriority;
    requester: string;
    startDate: string;
    deadline: string;
  }) => void;
  updateTask: (id: string, patch: Partial<RndTask>) => void;
  deleteTask: (id: string) => void;
  // Same "own function, not a plain patch" reasoning as
  // ProjectsProvider.setProjectNeedsSupport — this one also notifies Admin.
  setTaskNeedsSupport: (id: string, note: string) => void;
}

const RndTasksContext = createContext<RndTasksContextValue | null>(null);

export function RndTasksProvider({ children }: { children: ReactNode }) {
  const { addNotification } = useNotifications();
  const [rndTasks, setRndTasks] = useState<RndTask[]>(INITIAL_RND_TASKS);

  function addTask(input: {
    ownerName: string;
    title: string;
    category: TaskCategory;
    priority: TaskPriority;
    requester: string;
    startDate: string;
    deadline: string;
  }) {
    const id = `rndtask-${Date.now()}`;
    setRndTasks((prev) => [{ id, ...input }, ...prev]);
  }

  function updateTask(id: string, patch: Partial<RndTask>) {
    setRndTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function deleteTask(id: string) {
    setRndTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function setTaskNeedsSupport(id: string, note: string) {
    updateTask(id, { needsSupport: note });
    const trimmed = note.trim();
    if (!trimmed) return;
    const task = rndTasks.find((t) => t.id === id);
    const admin = STAFF.find((s) => s.role === "ADMIN");
    if (!task || !admin) return;
    addNotification({
      type: "RND_NEEDS_SUPPORT",
      title: `${task.title} cần hỗ trợ`,
      message: trimmed,
      link: "/my-tasks",
      recipientName: admin.name,
    });
  }

  return (
    <RndTasksContext.Provider value={{ rndTasks, addTask, updateTask, deleteTask, setTaskNeedsSupport }}>
      {children}
    </RndTasksContext.Provider>
  );
}

export function useRndTasks() {
  const ctx = useContext(RndTasksContext);
  if (!ctx) throw new Error("useRndTasks must be used within RndTasksProvider");
  return ctx;
}
