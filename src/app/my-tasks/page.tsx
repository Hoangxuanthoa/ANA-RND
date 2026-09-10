"use client";

import { useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { ProjectProductQuickView } from "@/components/ProjectProductQuickView";
import { NewProductModal } from "@/components/NewProductModal";
import { CURRENT_USER_NAME } from "@/lib/mock-data";
import { usageBadge, projectProductStatusBadge, customerApprovalBadge, TINT_BG, TINT_FG } from "@/lib/badges";
import { canViewMyTasks, canReleaseProjectProduct, canEditProduct, canSetExclusive, canReviewAsCreator, isAssignedRndOwner } from "@/lib/permissions";

export default function MyTasksPage() {
  const { role } = useRole();
  const userName = CURRENT_USER_NAME[role];
  const { projects, projectProducts, approveProjectProduct, rejectProjectProduct, resubmitProjectProduct } = useProjects();
  const { products, releaseToLibrary, setReusePermission } = useProducts();
  const [quickView, setQuickView] = useState<{ projectCode: string; productCode: string } | null>(null);
  const [editProductCode, setEditProductCode] = useState<string | null>(null);

  if (!canViewMyTasks(role)) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <TopNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-bg text-text-faint">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 018 0v3" />
            </svg>
          </div>
          <h2 className="text-[17px] font-extrabold">Không có quyền truy cập</h2>
          <p className="max-w-[360px] text-center text-sm text-text-muted">
            &quot;My Task&quot; là hàng đợi cá nhân dành cho R&amp;D.
          </p>
        </div>
      </div>
    );
  }

  const myItems = projectProducts.filter((pp) => pp.assigneeName === userName);
  const quickViewItem = quickView
    ? myItems.find((i) => i.projectCode === quickView.projectCode && i.productCode === quickView.productCode) ?? null
    : null;
  const quickViewProduct = quickViewItem ? products.find((p) => p.code === quickViewItem.productCode) : undefined;
  const quickViewProject = quickViewItem ? projects.find((p) => p.code === quickViewItem.projectCode) : undefined;
  const quickViewIsClosed = quickViewProject?.status === "CLOSED";
  const quickViewCanRelease =
    !!(quickViewItem && quickViewProduct && quickViewProject) &&
    canReleaseProjectProduct(role, userName, quickViewProject!, quickViewItem!, quickViewProduct!);
  const quickViewCanReviewHere =
    !!(quickViewItem && quickViewProject) &&
    !quickViewIsClosed &&
    quickViewItem.status === "SALES_REVIEW" &&
    canReviewAsCreator(role, userName, quickViewProject!);
  const quickViewCanResubmit =
    !!(quickViewItem && quickViewProject) &&
    !quickViewIsClosed &&
    quickViewItem.status === "DEVELOPING" &&
    quickViewItem.approval === "CHANGE_REQUESTED" &&
    isAssignedRndOwner(role, userName, quickViewProject!);
  const quickViewShowExclusiveToggle = !!quickViewItem && canSetExclusive(role) && !quickViewIsClosed && quickViewItem.usage === "NEW";
  const quickViewCanEditProduct =
    !!quickViewItem &&
    !!quickViewProduct &&
    (quickViewItem.status === "DEVELOPING" || !!quickViewProduct.incomplete) &&
    canEditProduct(role, userName, quickViewProduct);
  const editProductTarget = editProductCode ? products.find((p) => p.code === editProductCode) : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7">
        <p className="text-[13.5px] text-text-muted">{myItems.length} sản phẩm đang phụ trách</p>

        <div className="flex flex-col gap-3.5">
          {myItems.map((i) => {
            const product = products.find((p) => p.code === i.productCode);
            const project = projects.find((p) => p.code === i.projectCode);
            if (!product || !project) return null;
            const usage = usageBadge(i.usage);
            const s = projectProductStatusBadge(i.status);
            const approval = customerApprovalBadge(i.approval);
            return (
              <div
                key={`${i.projectCode}-${i.productCode}`}
                role="button"
                tabIndex={0}
                onClick={() => setQuickView({ projectCode: i.projectCode, productCode: i.productCode })}
                onKeyDown={(e) => e.key === "Enter" && setQuickView({ projectCode: i.projectCode, productCode: i.productCode })}
                className="flex cursor-pointer gap-4 rounded-xl border border-line bg-surface p-4 hover:bg-bg"
              >
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${product.mainImage ? "" : TINT_BG[product.tint]}`}>
                  {product.mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.mainImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                      <path d="M3 8v8l9 5 9-5V8" />
                      <path d="M12 13v8" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex justify-between gap-2.5">
                    <div>
                      <div className="text-sm font-bold">{product.name}</div>
                      <div className="mt-0.5 text-xs font-semibold text-text-faint">{product.code}</div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap justify-end gap-1.5">
                      <span className={usage.className}>{usage.label}</span>
                      <span className={s.className}>{s.label}</span>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${project.code}`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-fit text-[12px] font-semibold text-accent hover:text-accent-hover"
                  >
                    {project.name}
                  </Link>
                  {i.note && <p className="text-[12px] leading-relaxed text-text-muted">{i.note}</p>}
                  <span className={`w-fit ${approval.className}`}>{approval.label}</span>
                </div>
              </div>
            );
          })}

          {myItems.length === 0 && (
            <div className="py-16 text-center text-sm text-text-faint">Bạn chưa được giao việc nào.</div>
          )}
        </div>
      </div>

      {quickViewItem && quickViewProduct && quickViewProject && (
        <ProjectProductQuickView
          item={quickViewItem}
          product={quickViewProduct}
          isClosed={quickViewIsClosed}
          canReviewHere={quickViewCanReviewHere}
          canResubmit={quickViewCanResubmit}
          canRelease={quickViewCanRelease}
          showExclusiveToggle={quickViewShowExclusiveToggle}
          canEditProduct={quickViewCanEditProduct}
          onApprove={() => approveProjectProduct(quickViewItem.projectCode, quickViewItem.productCode)}
          onRequestChange={(reason) => rejectProjectProduct(quickViewItem.projectCode, quickViewItem.productCode, reason)}
          onResubmit={() => resubmitProjectProduct(quickViewItem.projectCode, quickViewItem.productCode)}
          onRelease={() => releaseToLibrary(quickViewProduct.code, quickViewProject.name)}
          onToggleExclusive={() =>
            setReusePermission(
              quickViewProduct.code,
              quickViewProduct.reuse === "EXCLUSIVE" ? "REUSABLE" : "EXCLUSIVE",
              userName,
            )
          }
          onEditProduct={() => {
            setEditProductCode(quickViewItem.productCode);
            setQuickView(null);
          }}
          onClose={() => setQuickView(null)}
        />
      )}

      {editProductTarget && (
        <NewProductModal
          open
          title="Sửa sản phẩm"
          product={editProductTarget}
          onCancel={() => setEditProductCode(null)}
          onCreate={() => setEditProductCode(null)}
        />
      )}
    </div>
  );
}
