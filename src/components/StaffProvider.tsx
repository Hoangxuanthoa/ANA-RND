"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/lib/mock-data";

// The real company roster — replaces the old hardcoded STAFF mock array
// in mock-data.ts. `name` (not `fullName`) is kept as the field name for
// drop-in compatibility with every existing call site (`s.name`,
// `.find(s => s.name === ...)`) — Projects/Products/RndTasks etc. still
// key ownership by this exact name string, unchanged, until their own
// migration turn (see PROGRESS.md's "Backend wiring" module order).
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "CUSTOMER">;
}

interface StaffContextValue {
  staff: StaffMember[];
  loading: boolean;
  // Admin-only — creates a real Supabase Auth user (with the password
  // Admin sets here directly) plus the matching User row. Returns an
  // error message on failure instead of throwing, so the form can show
  // it inline without a try/catch at the call site.
  addStaff: (input: { name: string; email: string; role: Exclude<Role, "CUSTOMER">; password: string }) => Promise<{
    error?: string;
  }>;
  updateStaffRole: (id: string, role: Exclude<Role, "CUSTOMER">) => void;
  // Deactivates (real login gets banned too) rather than deleting — a
  // real account has real history (Designer, rndOwner, ...) that can't
  // just disappear.
  removeStaff: (id: string) => void;
  // Admin setting someone ELSE's password directly (forgot it, first-day
  // setup, ...) — distinct from the self-service change in ProfileModal,
  // which is the signed-in user changing their own via a real Supabase
  // client call and needs their current password to do it.
  resetPassword: (id: string, password: string) => Promise<{ error?: string }>;
}

const StaffContext = createContext<StaffContextValue | null>(null);

interface ApiStaffMember {
  id: string;
  fullName: string;
  email: string;
  role: Exclude<Role, "CUSTOMER">;
}

function fromApi(u: ApiStaffMember): StaffMember {
  return { id: u.id, name: u.fullName, email: u.email, role: u.role };
}

export function StaffProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/staff")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ApiStaffMember[]) => {
        if (cancelled) return;
        setStaff(data.map(fromApi));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function addStaff(input: { name: string; email: string; role: Exclude<Role, "CUSTOMER">; password: string }) {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: input.name, email: input.email, role: input.role, password: input.password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      return { error: body.error ?? "Không tạo được tài khoản." };
    }
    const created: ApiStaffMember = await res.json();
    setStaff((prev) => [...prev, fromApi(created)]);
    return {};
  }

  function updateStaffRole(id: string, role: Exclude<Role, "CUSTOMER">) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
    fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
  }

  function removeStaff(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
  }

  async function resetPassword(id: string, password: string) {
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      return { error: body.error ?? "Không đặt lại được mật khẩu." };
    }
    return {};
  }

  return (
    <StaffContext.Provider value={{ staff, loading, addStaff, updateStaffRole, removeStaff, resetPassword }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used within StaffProvider");
  return ctx;
}
