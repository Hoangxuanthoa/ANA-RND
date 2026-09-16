"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CURRENT_USER_EMAIL, CURRENT_USER_NAME, CURRENT_USER_PHONE, type Role } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  email: string;
  phone: string;
}

// The real, authenticated account behind this browser session — fetched
// once from /api/me. Distinct from `role` below, which Admin can
// override to preview another role's UI without actually being that
// person (see isRealAdmin/setRole).
interface RealIdentity {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
}

const RoleContext = createContext<{
  role: Role;
  setRole: (role: Role) => void;
  // True only when the real signed-in account is Admin — gates both the
  // "Xem thử vai trò" switcher and whether setRole does anything at all.
  isRealAdmin: boolean;
  // True when the effective `role` is your own real account (not an
  // Admin preview of a different role) — email is only ever editable
  // (well, real at all) in this case.
  isPreviewingSelf: boolean;
  // The real signed-in account's id — null while previewing (there's no
  // real "become this person" mechanism), for backend modules that need
  // to stamp real ownership (e.g. Product.designerId) instead of the old
  // CURRENT_USER_NAME mock mapping.
  userId: string | null;
  // Real name when acting as yourself; falls back to the old fictional
  // per-role preview name when Admin is previewing a role that isn't
  // their own — a preview has no single real backing person, so that
  // part of the mock mapping is still needed there.
  effectiveUserName: string;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  signOut: () => Promise<void>;
} | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // /login never has a session to fetch (middleware already redirects
  // anyone who does have one away from it) and doesn't read useRole() at
  // all — skip the fetch entirely so it never blocks on a loading screen.
  const isLoginPage = pathname === "/login";
  const [real, setReal] = useState<RealIdentity | null>(null);
  const [loading, setLoading] = useState(!isLoginPage);
  const [role, setRoleState] = useState<Role>("RND");
  // Fake per-role contact info shown only while Admin is previewing a
  // role that isn't their own real account — there's no real "become
  // this person" mechanism, so this stays mock/local, same as before.
  const [previewProfiles, setPreviewProfiles] = useState<Record<Role, Profile>>({
    ADMIN: { email: CURRENT_USER_EMAIL.ADMIN, phone: CURRENT_USER_PHONE.ADMIN },
    RND: { email: CURRENT_USER_EMAIL.RND, phone: CURRENT_USER_PHONE.RND },
    SALES: { email: CURRENT_USER_EMAIL.SALES, phone: CURRENT_USER_PHONE.SALES },
    MARKETING: { email: CURRENT_USER_EMAIL.MARKETING, phone: CURRENT_USER_PHONE.MARKETING },
    CUSTOMER: { email: CURRENT_USER_EMAIL.CUSTOMER, phone: CURRENT_USER_PHONE.CUSTOMER },
  });

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setReal({ id: data.id, role: data.role, fullName: data.fullName, email: data.email, phone: data.phone });
        setRoleState(data.role);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoginPage]);

  const isRealAdmin = real?.role === "ADMIN";
  const isPreviewingSelf = !real || role === real.role;
  const userId = isPreviewingSelf && real ? real.id : null;
  const effectiveUserName = isPreviewingSelf && real ? real.fullName : CURRENT_USER_NAME[role];

  function setRole(next: Role) {
    if (!isRealAdmin) return;
    setRoleState(next);
  }

  const profile: Profile =
    isPreviewingSelf && real ? { email: real.email, phone: real.phone ?? "" } : previewProfiles[role];

  function updateProfile(patch: Partial<Profile>) {
    if (isPreviewingSelf) {
      if (patch.phone === undefined) return;
      const phone = patch.phone;
      setReal((prev) => (prev ? { ...prev, phone } : prev));
      fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      return;
    }
    setPreviewProfiles((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg" />;
  }

  return (
    <RoleContext.Provider
      value={{ role, setRole, isRealAdmin, isPreviewingSelf, userId, effectiveUserName, profile, updateProfile, signOut }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
