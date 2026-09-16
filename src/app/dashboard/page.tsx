"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { NewProductModal } from "@/components/NewProductModal";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { DASHBOARD_ACTIVITY, ROLE_LABEL, CURRENT_USER_NAME, parseDDMMYYYY } from "@/lib/mock-data";
import { productStatusBadge, TINT_BG, TINT_FG } from "@/lib/badges";
import { canCreateProduct, canViewLibrary, canSeeProductInLibrary, isMyProject } from "@/lib/permissions";

function StatCard({
  icon,
  value,
  label,
  bg,
  fg,
  href,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  bg: string;
  fg: string;
  href?: string;
}) {
  const content = (
    <>
      <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg ${bg} ${fg}`}>
        {icon}
      </div>
      <div className="text-[26px] font-extrabold leading-none">{value}</div>
      <div className="text-[13px] font-semibold text-text-muted">{label}</div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-5 transition hover:shadow-md"
      >
        {content}
      </Link>
    );
  }
  return <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-5">{content}</div>;
}

const IconBox = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);
const IconFolder = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
  </svg>
);
const IconPlus = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconBell = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 01-3.4 0" />
  </svg>
);

export default function DashboardPage() {
  const router = useRouter();
  const { role, effectiveUserName } = useRole();
  // Projects/ProjectProduct ownership checks below still compare against
  // mock data, so they keep the old per-role fictional name until
  // Projects is wired for real; the Library visibility check and the
  // greeting use the real signed-in name.
  const userName = CURRENT_USER_NAME[role];
  const { products } = useProducts();
  const { projects, projectProducts } = useProjects();
  const isCustomer = role === "CUSTOMER";
  const isAdmin = role === "ADMIN";
  const isRnd = role === "RND";
  const visibleProducts = products.filter((p) => canSeeProductInLibrary(role, effectiveUserName, p));
  const recentProducts = [...visibleProducts]
    .sort((a, b) => (parseDDMMYYYY(b.createdAt)?.getTime() ?? 0) - (parseDDMMYYYY(a.createdAt)?.getTime() ?? 0))
    .slice(0, 3);
  const pendingReviewCount = products.filter((p) => p.status === "PENDING_REVIEW").length;
  const activeProjectsCount = projects.filter((p) => p.status === "DEVELOPING").length;
  // The "hero" number — proof the library actually gets reused, not just
  // built: how many times a design has been picked up by REUSE (vs. NEW)
  // across every project, and how many distinct designs that represents.
  const reuseInstances = projectProducts.filter((pp) => pp.usage === "REUSE");
  const reusedDesignCount = new Set(reuseInstances.map((pp) => pp.productCode)).size;

  // "Need Action" — what this role specifically still has to do, not a
  // generic placeholder:
  // - Admin: products waiting in the review queue.
  // - R&D: their own assigned work that isn't done yet (not APPROVED/COMPLETED).
  // - Sales/Marketing: items on their own projects where the customer asked for changes.
  const needActionCount = isAdmin
    ? pendingReviewCount
    : isRnd
      ? projectProducts.filter(
          (pp) => pp.assigneeName === userName && pp.status !== "APPROVED" && pp.status !== "COMPLETED",
        ).length
      : projectProducts.filter(
          (pp) =>
            pp.approval === "CHANGE_REQUESTED" &&
            projects.some((p) => p.code === pp.projectCode && isMyProject(role, userName, p)),
        ).length;
  const needActionHref = isAdmin ? "/review" : isRnd ? "/my-tasks" : "/projects";

  const customerProjects = projects.filter((p) => p.isMine);
  const customerNeedResponseCount = projectProducts.filter(
    (pp) => pp.status === "CUSTOMER_REVIEW" && customerProjects.some((p) => p.code === pp.projectCode),
  ).length;

  const [newProductOpen, setNewProductOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-7 p-7">
        <div>
          <h1 className="mb-1 text-[22px] font-extrabold">
            Chào buổi sáng, {isCustomer ? "JYSK Buyer" : effectiveUserName}
          </h1>
          <p className="text-sm text-text-muted">
            Đang xem với vai trò <strong className="text-text">{ROLE_LABEL[role]}</strong>
          </p>
        </div>

        <div className={`grid gap-4 ${isCustomer ? "grid-cols-2" : "grid-cols-4"}`}>
          {isCustomer ? (
            <>
              <StatCard
                icon={IconFolder}
                value={String(customerProjects.length)}
                label="Dự án của bạn"
                bg="bg-accent-soft"
                fg="text-accent-soft-text"
                href="/projects"
              />
              <StatCard
                icon={IconBell}
                value={String(customerNeedResponseCount)}
                label="Cần phản hồi"
                bg="bg-amber-soft"
                fg="text-amber"
                href="/projects"
              />
            </>
          ) : (
            <>
              <StatCard
                icon={IconBox}
                value={String(reuseInstances.length)}
                label={`Lượt tái sử dụng (${reusedDesignCount} thiết kế)`}
                bg="bg-accent-soft"
                fg="text-accent-soft-text"
              />
              <StatCard
                icon={IconBox}
                value={String(visibleProducts.length)}
                label="Products"
                bg="bg-blue-soft"
                fg="text-blue"
                href="/library"
              />
              <StatCard
                icon={IconFolder}
                value={String(activeProjectsCount)}
                label="Active Projects"
                bg="bg-green-soft"
                fg="text-green"
                href="/projects"
              />
              <StatCard
                icon={IconBell}
                value={String(needActionCount)}
                label={isAdmin ? "Chờ duyệt sản phẩm" : "Cần xử lý"}
                bg="bg-amber-soft"
                fg="text-amber"
                href={needActionHref}
              />
            </>
          )}
        </div>

        {canViewLibrary(role) && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold">Sản phẩm mới thêm</h2>
              <div className="flex items-center gap-2.5">
                {canCreateProduct(role) && (
                  <button
                    onClick={() => setNewProductOpen(true)}
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover"
                  >
                    {IconPlus} Sản phẩm mới
                  </button>
                )}
                <Link href="/library" className="text-[13px] font-bold text-accent hover:text-accent-hover">
                  Xem thư viện →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {recentProducts.map((p) => {
                const badge = productStatusBadge(p.status);
                return (
                  <Link
                    key={p.code}
                    href={`/library/${p.code}`}
                    className="overflow-hidden rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className={`flex aspect-square items-center justify-center overflow-hidden ${p.mainImage ? "" : TINT_BG[p.tint]}`}>
                      {p.mainImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.mainImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.4">
                          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                          <path d="M3 8v8l9 5 9-5V8" />
                          <path d="M12 13v8" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-bold">{p.name}</div>
                          <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">{p.code}</div>
                        </div>
                        <span className={badge.className}>{badge.label}</span>
                      </div>
                      <div className="text-[11.5px] text-text-muted">
                        {p.category} · {p.material}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          <h2 className="text-[16px] font-extrabold">Hoạt động gần đây</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {DASHBOARD_ACTIVITY.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-line px-4.5 py-3.5 last:border-b-0 hover:bg-bg"
              >
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINT_BG[a.tint]} ${TINT_FG[a.tint]}`}>
                  {a.initials}
                </div>
                <div className="flex-1 text-[13px]">
                  <strong>{a.actor}</strong> <span className="text-text-muted">{a.action}</span>{" "}
                  {a.target && <strong>{a.target}</strong>}
                </div>
                <div className="whitespace-nowrap text-xs text-text-faint">{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {newProductOpen && (
        <NewProductModal
          open
          autoSubmit
          onCancel={() => setNewProductOpen(false)}
          onCreate={(code) => {
            setNewProductOpen(false);
            router.push(`/library/${code}`);
          }}
        />
      )}
    </div>
  );
}
