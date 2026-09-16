"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { NotificationItem, NotificationType } from "@/lib/mock-data";

// A shared inbox. Real notifications (Products/Projects) are fetched
// from the server, already filtered to "mine" — every mutation that
// generates one writes a real Notification row server-side instead of
// calling anything here (see src/lib/server/notify.ts).
//
// addNotification() still exists purely as a **local, unsynced**
// fallback for the modules not wired to a real backend yet
// (Collections, RndTasks) — same shape as the old fully-mock provider,
// kept so those two don't need to change until their own turn. Locally
// added entries carry `recipientName` and get matched against the
// viewer's name at render time (see TopNav); real ones don't need
// that, the server already scoped them.
interface NotificationsContextValue {
  notifications: NotificationItem[];
  addNotification: (input: {
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    recipientName: string;
  }) => void;
  markNotificationRead: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then(setNotifications);
  }, []);

  function addNotification(input: {
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    recipientName: string;
  }) {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications((prev) => [{ id, isRead: false, time: "Vừa xong", ...input }, ...prev]);
  }

  function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (!id.startsWith("local-")) {
      fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
    }
  }

  return (
    <NotificationsContext.Provider value={{ notifications, addNotification, markNotificationRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
