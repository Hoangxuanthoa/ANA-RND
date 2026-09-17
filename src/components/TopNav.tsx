"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useNotifications } from "@/components/NotificationsProvider";
import { ProfileModal } from "@/components/ProfileModal";
import { ROLE_LABEL, initialsFromName } from "@/lib/mock-data";
import { TINT_AVATAR_BG } from "@/lib/badges";
import { canViewLibrary, canReviewProducts, canViewMyTasks, canManageSettings, canManageCollections } from "@/lib/permissions";

function NavLink({
  href,
  children,
  badge,
  fullWidth,
}: {
  href: string;
  children: React.ReactNode;
  badge?: number;
  // The stacked mobile menu wants each link to be a full-width tap
  // target; the horizontal desktop nav wants links sized to content.
  fullWidth?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      // TopNav is on every page with 5-7 of these links always in
      // view, so Next's default viewport-prefetch would fire that many
      // background RSC requests on every single page load — pure
      // contention against the real data fetches the current page
      // actually needs, for a route the user may never click into.
      prefetch={false}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13.5px] font-semibold ${fullWidth ? "w-full" : ""} ${
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
  const { role, effectiveUserName, profile, updateProfile, signOut } = useRole();
  const { products } = useProducts();
  const { notifications, markNotificationRead } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const [bellOpen, setBellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Closing the mobile nav on every navigation (not just outside-click)
  // — otherwise tapping a link leaves the panel visibly open underneath
  // while the new page loads.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const pendingCount = products.filter((p) => p.status === "PENDING_REVIEW").length;
  const userName = effectiveUserName;
  // Real notifications (Products/Projects) arrive from the server
  // already scoped to "mine" (no recipientName at all); only the
  // still-mock Collections/RndTasks ones carry a recipientName that
  // needs matching against who's currently being viewed as.
  const myNotifications = notifications.filter((n) => !n.recipientName || n.recipientName.startsWith(userName));
  const unreadCount = myNotifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!bellOpen && !accountOpen && !mobileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (bellOpen && bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (accountOpen && accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [bellOpen, accountOpen, mobileMenuOpen]);

  const navLinks = (fullWidth: boolean) => (
    <>
      <NavLink href="/dashboard" fullWidth={fullWidth}>Dashboard</NavLink>
      {canViewLibrary(role) && <NavLink href="/library" fullWidth={fullWidth}>Library</NavLink>}
      <NavLink href="/projects" fullWidth={fullWidth}>Projects</NavLink>
      {canViewMyTasks(role) && <NavLink href="/my-tasks" fullWidth={fullWidth}>My Task</NavLink>}
      {canManageCollections(role) && <NavLink href="/collections" fullWidth={fullWidth}>Collections</NavLink>}
      {canReviewProducts(role) && (
        <NavLink href="/review" badge={pendingCount} fullWidth={fullWidth}>
          Duyệt sản phẩm
        </NavLink>
      )}
      {canManageSettings(role) && <NavLink href="/settings" fullWidth={fullWidth}>Cài đặt</NavLink>}
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center justify-between border-b border-line bg-surface px-4 sm:px-7">
        <div className="flex items-center gap-4 sm:gap-8">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg hover:text-text md:hidden"
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Artex Nam An" className="h-7 w-auto" />
            <span className="hidden text-[15px] font-bold sm:inline">ANA-RND</span>
          </div>
          <nav className="hidden gap-1 md:flex">{navLinks(false)}</nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5">
          <div className="relative" ref={bellRef}>
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
              <div className="absolute top-11 right-0 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
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

          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setAccountOpen((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${TINT_AVATAR_BG[role]}`}
            >
              {initialsFromName(userName)}
            </button>

            {accountOpen && (
              <div className="absolute top-11 right-0 z-40 flex w-64 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
                <div className="border-b border-line px-4 py-3">
                  <p className="text-[13px] font-bold">{userName}</p>
                  <p className="text-[12px] text-text-faint">
                    {ROLE_LABEL[role]} · {profile.email}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-bg"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Cập nhật thông tin
                </button>
                <div className="border-t border-line" />
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    signOut();
                  }}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-red hover:bg-red-soft"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          ref={mobileMenuRef}
          // fixed, not absolute — this no longer has a `position:
          // relative` ancestor to anchor to (that wrapper was removed:
          // it collapsed to the nav bar's own 64px height with nothing
          // else in normal flow, which broke the sticky bar's "room to
          // stick within" and made it scroll away immediately instead
          // of staying pinned). fixed is viewport-relative on its own.
          className="fixed top-16 right-0 left-0 z-30 flex flex-col gap-1 border-b border-line bg-surface p-3 shadow-md md:hidden"
        >
          {navLinks(true)}
        </nav>
      )}

      <ProfileModal
        open={profileModalOpen}
        role={role}
        name={userName}
        email={profile.email}
        phone={profile.phone}
        onSave={(patch) => {
          updateProfile(patch);
          setProfileModalOpen(false);
        }}
        onCancel={() => setProfileModalOpen(false)}
      />
    </>
  );
}
