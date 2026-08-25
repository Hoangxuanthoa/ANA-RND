"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role } from "@/lib/mock-data";

const RoleContext = createContext<{
  role: Role;
  setRole: (role: Role) => void;
} | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("RND");
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
