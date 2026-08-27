"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { ROLE_LABEL, ROLE_INITIALS, CURRENT_USER_NAME, type Role } from "@/lib/mock-data";
import { TINT_AVATAR_BG } from "@/lib/badges";
import { canViewLibrary, canReviewProducts, canViewMyTasks, canManageSettings, canManageCollections } from "@/lib/permissions";

const ROLES: Role[] = ["ADMIN", "RND", "SALES", "MARKETING", "CUSTOMER"];

function NavLink({
  href,
  children,
  badge,
}: {
  href: string;
  children: React.ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold ${
        active
          ? "bg-accent-soft text-accent-soft-text"
          : "text-text-muted hover:bg-bg hover:text-text"
      }`}
    >
      {children}
      {!!badge && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function TopNav() {
  const { role, setRole } = useRole();
  const { products, notifications, markNotificationRead } = useProducts();
  const router = useRouter();
  const [bellOpen, setBellOpen] = useState(false);

  const pendingCount = products.filter((p) => p.status === "PENDING_REVIEW").length;
  const userName = CURRENT_USER_NAME[role];
  const myNotifications = notifications.filter((n) => n.recipientName.startsWith(userName));
  const unreadCount = myNotifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative flex h-16 flex-shrink-0 items-center justify-between border-b border-line bg-surface px-7">
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
          {canViewMyTasks(role) && <NavLink href="/my-tasks">Việc của tôi</NavLink>}
          {canManageCollections(role) && <NavLink href="/collections">Collections</NavLink>}
          {canReviewProducts(role) && (
            <NavLink href="/review" badge={pendingCount}>
              Duyệt sản phẩm
            </NavLink>
          )}
          {canManageSettings(role) && <NavLink href="/settings">Cài đặt</NavLink>}
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

        <div className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-text-muted hover:bg-bg hover:text-text"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red" />
            )}
          </button>

          {bellOpen && (
            <div className="absolute top-11 right-0 z-40 flex w-80 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
              <div className="border-b border-line px-4 py-3 text-[13px] font-bold">Thông báo</div>
              <div className="max-h-80 overflow-y-auto">
                {myNotifications.length === 0 && (
                  <p className="p-4 text-[12.5px] text-text-faint">Không có thông báo nào.</p>
                )}
                {myNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                      setBellOpen(false);
                      router.push(n.link);
                    }}
                    className={`flex w-full flex-col gap-1 border-b border-line p-3.5 text-left last:border-b-0 hover:bg-bg ${
                      n.isRead ? "" : "bg-amber-soft/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold">{n.title}</span>
                      {!n.isRead && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red" />}
                    </div>
                    <p className="text-[12px] leading-relaxed text-text-muted">{n.message}</p>
                    <span className="text-[11px] text-text-faint">{n.time}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
