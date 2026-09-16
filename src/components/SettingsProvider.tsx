"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

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
  pptxTemplate: PptxTemplateSettings;
  updatePptxTemplate: (patch: Partial<PptxTemplateSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [pptxTemplate, setPptxTemplate] = useState<PptxTemplateSettings>(DEFAULT_PPTX_TEMPLATE);

  function updatePptxTemplate(patch: Partial<PptxTemplateSettings>) {
    setPptxTemplate((prev) => ({ ...prev, ...patch }));
  }

  return (
    <SettingsContext.Provider value={{ pptxTemplate, updatePptxTemplate }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
