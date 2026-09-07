"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CURRENT_USER_EMAIL, CURRENT_USER_PHONE, type Role } from "@/lib/mock-data";

interface Profile {
  email: string;
  phone: string;
}

const RoleContext = createContext<{
  role: Role;
  setRole: (role: Role) => void;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
} | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("RND");
  const [profiles, setProfiles] = useState<Record<Role, Profile>>({
    ADMIN: { email: CURRENT_USER_EMAIL.ADMIN, phone: CURRENT_USER_PHONE.ADMIN },
    RND: { email: CURRENT_USER_EMAIL.RND, phone: CURRENT_USER_PHONE.RND },
    SALES: { email: CURRENT_USER_EMAIL.SALES, phone: CURRENT_USER_PHONE.SALES },
    MARKETING: { email: CURRENT_USER_EMAIL.MARKETING, phone: CURRENT_USER_PHONE.MARKETING },
    CUSTOMER: { email: CURRENT_USER_EMAIL.CUSTOMER, phone: CURRENT_USER_PHONE.CUSTOMER },
  });

  function updateProfile(patch: Partial<Profile>) {
    setProfiles((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  return (
    <RoleContext.Provider value={{ role, setRole, profile: profiles[role], updateProfile }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
