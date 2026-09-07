"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { INITIAL_NOTIFICATIONS, type NotificationItem, type NotificationType } from "@/lib/mock-data";

// A shared inbox every other provider (Products/Projects/Collections)
// pushes into — kept separate from all of them, and above them in
// layout.tsx, so none of the three needs to import from the others just
// to raise a notification about its own events.
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
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  function addNotification(input: {
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    recipientName: string;
  }) {
    const id = `${input.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications((prev) => [{ id, isRead: false, time: "Vừa xong", ...input }, ...prev]);
  }

  function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
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
