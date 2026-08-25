"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/components/RoleProvider";
import { ROLE_LABEL, ROLE_INITIALS, type Role } from "@/lib/mock-data";
import { TINT_AVATAR_BG } from "@/lib/badges";
import { canViewLibrary } from "@/lib/permissions";

const ROLES: Role[] = ["ADMIN", "RND", "SALES", "CUSTOMER"];

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`rounded-lg px-3.5 py-2 text-[13.5px] font-semibold ${
        active
          ? "bg-accent-soft text-accent-soft-text"
          : "text-text-muted hover:bg-bg hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

export function TopNav() {
  const { role, setRole } = useRole();

  return (
    <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-line bg-surface px-7">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
          </svg>
          <span className="text-[15px] font-bold">R&amp;D Design Library</span>
        </div>
        <nav className="flex gap-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          {canViewLibrary(role) && <NavLink href="/library">Design Library</NavLink>}
          <NavLink href="/projects">Projects</NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-3.5">
        <span className="text-[11px] font-semibold text-text-faint">Xem thử vai trò:</span>
        <div className="flex rounded-lg border border-line bg-bg p-0.5">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                role === r ? "bg-surface text-text shadow-sm" : "text-text-faint"
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${TINT_AVATAR_BG[role]}`}
        >
          {ROLE_INITIALS[role]}
        </div>
      </div>
    </div>
  );
}
