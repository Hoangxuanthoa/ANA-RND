"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { STAFF as INITIAL_STAFF, type StaffMember, type Role } from "@/lib/mock-data";

type StaffRole = Exclude<Role, "CUSTOMER">;

// Cover/closing slide look for the Collection PPTX export — Admin-wide,
// applies to every export. Product-info slides are NOT customizable here
// (fixed layouts, see pptxExport.ts) — the user only wanted the
// cover/closing images swappable (seasonal/theme banners), not the
// product data pages.
export interface PptxTemplateSettings {
  coverImage?: string;
  closingImage?: string;
  closingText: string;
}

const DEFAULT_PPTX_TEMPLATE: PptxTemplateSettings = {
  closingText: "Cảm ơn quý khách",
};

interface SettingsContextValue {
  staff: StaffMember[];
  addStaff: (name: string, role: StaffRole) => void;
  updateStaffRole: (id: string, role: StaffRole) => void;
  removeStaff: (id: string) => void;
  pptxTemplate: PptxTemplateSettings;
  updatePptxTemplate: (patch: Partial<PptxTemplateSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [pptxTemplate, setPptxTemplate] = useState<PptxTemplateSettings>(DEFAULT_PPTX_TEMPLATE);

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

  function updatePptxTemplate(patch: Partial<PptxTemplateSettings>) {
    setPptxTemplate((prev) => ({ ...prev, ...patch }));
  }

  return (
    <SettingsContext.Provider
      value={{ staff, addStaff, updateStaffRole, removeStaff, pptxTemplate, updatePptxTemplate }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
