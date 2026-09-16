"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  email: string;
  phone: string;
}

// The real, authenticated account behind this browser session — fetched
// once from /api/me.
interface RealIdentity {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
}

const RoleContext = createContext<{
  role: Role;
  userId: string | null;
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
  // The public Collection share page is the same story for a different
  // reason: it's meant to work with no session at all (see
  // src/lib/supabase/middleware.ts), and it doesn't read useRole() either.
  const isLoginPage = pathname === "/login";
  const skipIdentityFetch = isLoginPage || !!pathname?.startsWith("/share/");
  const [real, setReal] = useState<RealIdentity | null>(null);
  const [loading, setLoading] = useState(!skipIdentityFetch);

  useEffect(() => {
    if (skipIdentityFetch) {
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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [skipIdentityFetch]);

  // Placeholder role/name while loading or on a page with no session
  // (/login, /share/*) — never actually rendered against real data, since
  // those pages don't read useRole() at all.
  const role = real?.role ?? "RND";
  const userId = real?.id ?? null;
  const effectiveUserName = real?.fullName ?? "";
  const profile: Profile = real ? { email: real.email, phone: real.phone ?? "" } : { email: "", phone: "" };

  function updateProfile(patch: Partial<Profile>) {
    if (patch.phone === undefined) return;
    const phone = patch.phone;
    setReal((prev) => (prev ? { ...prev, phone } : prev));
    fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
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
    <RoleContext.Provider value={{ role, userId, effectiveUserName, profile, updateProfile, signOut }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
