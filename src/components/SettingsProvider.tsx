"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { STAFF as INITIAL_STAFF, type StaffMember, type Role } from "@/lib/mock-data";

type StaffRole = Exclude<Role, "CUSTOMER">;

interface SettingsContextValue {
  staff: StaffMember[];
  addStaff: (name: string, role: StaffRole) => void;
  updateStaffRole: (id: string, role: StaffRole) => void;
  removeStaff: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);

  function addStaff(name: string, role: StaffRole) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStaff((prev) => [...prev, { id: `usr-${Date.now()}`, name: trimmed, role }]);
  }

  function updateStaffRole(id: string, role: StaffRole) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
  }

  function removeStaff(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <SettingsContext.Provider value={{ staff, addStaff, updateStaffRole, removeStaff }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
