"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditProjectModal } from "@/components/EditProjectModal";
import { NewProductModal } from "@/components/NewProductModal";
import { ProjectProductQuickView } from "@/components/ProjectProductQuickView";
import { CURRENT_USER_NAME, ROLE_INITIALS, PROJECT_ACTIVITY } from "@/lib/mock-data";
import {
  projectStatusBadge,
  projectTypeBadge,
  usageBadge,
  projectProductStatusBadge,
  reusePermissionBadge,
  TINT_BG,
  TINT_FG,
} from "@/lib/badges";
import {
  canPickProduct,
  canCreateProduct,
  canEditProject,
  canHardDeleteProject,
  canMarkCompleted,
  canReleaseToLibrary,
  canSetExclusive,
  canReviewAsCreator,
  isAssignedRndOwner,
} from "@/lib/permissions";

const TABS = [
  { key: "products", label: "Product Development" },
  { key: "feedback", label: "General Feedback" },
  { key: "activity", label: "Activity" },
] as const;

export default function ProjectDetailPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { role } = useRole();
  const {
    projects,
    projectProducts,
    projectFeedback,
    closeProject,
    markCompleted,
    deleteProject,
    updateProject,
    addProjectFeedback,
    addProductToProject,
    approveProjectProduct,
    rejectProjectProduct,
    resubmitProjectProduct,
  } = useProjects();
  const { products, releaseToLibrary, setReusePermission } = useProducts();
  const userName = CURRENT_USER_NAME[role];
  const project = projects.find((p) => p.code === params.code);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("products");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quickViewCode, setQuickViewCode] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [newDesignOpen, setNewDesignOpen] = useState(false);

  if (!project) return notFound();

  const feedback = projectFeedback.filter((f) => f.projectCode === project.code);

  const status = projectStatusBadge(project.status);
  const typeBadge = projectTypeBadge(project.type);
  const editable = canEditProject(role, userName, project);
  const hardDelete = canHardDeleteProject(project);
  const isClosed = project.status === "CLOSED";
  const isCompleted = project.status === "COMPLETED";
  // New products can only be added/picked while the project is still
  // actively being worked — not once every item has already been
  // Approved (Completed) or the project has been Closed.
  const canModifyProducts = project.status === "CREATED" || project.status === "DEVELOPING";
  const items = projectProducts.filter((pp) => pp.projectCode === project.code);
  const quickViewItem = items.find((i) => i.productCode === quickViewCode) ?? null;
  const quickViewProduct = quickViewItem ? products.find((p) => p.code === quickViewItem.productCode) : undefined;
  const quickViewCanRelease =
    !!(quickViewItem && quickViewProduct) &&
    canReleaseToLibrary(role, userName, project) &&
    quickViewItem!.status === "APPROVED" &&
    quickViewProduct!.status === "DRAFT";
  const quickViewCanReviewHere =
    !!quickViewItem && !isClosed && quickViewItem.status === "SALES_REVIEW" && canReviewAsCreator(role, userName, project);
  const quickViewCanResubmit =
    !!quickViewItem &&
    !isClosed &&
    quickViewItem.status === "DEVELOPING" &&
    quickViewItem.approval === "CHANGE_REQUESTED" &&
    isAssignedRndOwner(role, userName, project);
  const quickViewShowExclusiveToggle = !!quickViewItem && canSetExclusive(role) && !isClosed && quickViewItem.usage === "NEW";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 p-7">
        <div className="text-[13px] text-text-faint">
          <Link href="/projects" className="text-accent hover:text-accent-hover">
            Projects
          </Link>{" "}
          / <span className="text-text">{project.name}</span>
        </div>

        <div className="flex justify-between gap-5 rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold">{project.name}</h1>
              <span className={typeBadge.className}>{typeBadge.label}</span>
              <span className={status.className}>{status.label}</span>
            </div>
            <div className="text-[13px] font-semibold text-text-faint">{project.code}</div>
            <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-text-muted">
              {project.brief}
            </p>
            {project.attachments.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {project.attachments.map((file) => (
                  <span
                    key={file}
                    className="inline-flex items-center gap-1.5 rounded-md bg-bg px-2.5 py-1 text-[11.5px] font-semibold text-text-muted"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3 3 0 014.24 4.24l-9.19 9.19a1 1 0 01-1.41-1.41l8.49-8.49" />
                    </svg>
                    {file}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-4">
            <div className="flex gap-7">
              {[
                ["Customer", project.customer ?? "—"],
                ["Sales", project.sales ?? "—"],
                ["R&D Owner", project.rndOwner ?? "—"],
                ["Deadline", project.deadline],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-text-faint">{label}</span>
                  <span className="text-[13px] font-bold">{value}</span>
                </div>
              ))}
            </div>
            {editable && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditOpen(true)}
                  className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
                >
                  Sửa
                </button>
                {canMarkCompleted(role, userName, project) && project.status === "DEVELOPING" && (
                  <button
                    onClick={() => markCompleted(project.code)}
                    className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold text-green hover:bg-green-soft"
                  >
                    Đánh dấu Hoàn thành
                  </button>
                )}
                {!isClosed && (
                  <button
                    onClick={() => setConfirmOpen(true)}
                    className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold text-red hover:bg-red-soft"
                  >
                    {hardDelete ? "Xóa" : "Đóng dự án"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-[42px] border-b-2 text-[13.5px] font-bold ${
                tab === t.key ? "border-accent text-text" : "border-transparent text-text-faint"
              }`}
            >
              {t.label} {t.key === "products" ? `(${items.length})` : t.key === "feedback" ? `(${feedback.length})` : ""}
            </button>
          ))}
        </div>

        {tab === "products" && (
          <div className="flex flex-col gap-3.5">
            {isClosed && (
              <div className="rounded-lg border border-line bg-bg px-4 py-2.5 text-[12.5px] font-semibold text-text-faint">
                Dự án đã đóng — chỉ để xem lại, không thể chỉnh sửa thêm.
              </div>
            )}
            {isCompleted && (
              <div className="rounded-lg border border-line bg-bg px-4 py-2.5 text-[12.5px] font-semibold text-text-faint">
                Dự án đã hoàn thành — R&amp;D phụ trách có thể Release to Library cho các thiết kế mới, rồi đóng dự án.
              </div>
            )}
            {canModifyProducts && (canPickProduct(role) || canCreateProduct(role)) && (
              <div className="flex justify-end gap-2">
                {canCreateProduct(role) && (
                  <button
                    onClick={() => setNewDesignOpen(true)}
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-[13px] font-bold hover:bg-bg"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v12M7 8l5-5 5 5" />
                      <path d="M5 21h14" />
                    </svg>
                    Thiết kế mới
                  </button>
                )}
                {canPickProduct(role) && (
                  <Link
                    href="/library"
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Pick Product
                  </Link>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {items.map((i) => {
                const product = products.find((p) => p.code === i.productCode);
                if (!product) return null;
                const usage = usageBadge(i.usage);
                const s = projectProductStatusBadge(i.status);
                const reuse = reusePermissionBadge(product.reuse);
                const needsAttention =
                  !isClosed && (i.status === "SALES_REVIEW" || (i.status === "CUSTOMER_REVIEW" && i.approval === "PENDING"));

                return (
                  <button
                    key={i.productCode}
                    onClick={() => setQuickViewCode(i.productCode)}
                    className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-left hover:border-accent/40"
                  >
                    <div
                      className={`relative flex h-40 items-center justify-center overflow-hidden ${
                        product.mainImage ? "" : TINT_BG[product.tint]
                      }`}
                    >
                      {product.mainImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.mainImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.4">
                          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                          <path d="M3 8v8l9 5 9-5V8" />
                          <path d="M12 13v8" />
                        </svg>
                      )}
                      {needsAttention && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber px-2 py-1 text-[10.5px] font-bold text-white">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Cần duyệt
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3.5">
                      <div>
                        <div className="truncate text-[13px] font-bold">{product.name}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-text-faint">{product.code}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={usage.className}>{usage.label}</span>
                        <span className={s.className}>{s.label}</span>
                        <span className={reuse.className}>{reuse.label}</span>
                      </div>
                      {i.note && <p className="truncate text-[11.5px] text-text-muted">{i.note}</p>}
                      <div className="mt-auto flex items-center justify-between border-t border-line pt-2 text-[11px] text-text-faint">
                        <span className="truncate">{i.assigneeName ?? "Chưa gán"}</span>
                        <span className="flex-shrink-0">Feedback ({i.feedback.length})</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {items.length === 0 && (
              <div className="py-10 text-center text-sm text-text-faint">Chưa có sản phẩm nào trong dự án này.</div>
            )}
          </div>
        )}

        {tab === "feedback" && (
          <div className="flex max-w-[720px] flex-col gap-4">
            {feedback.map((f, i) => (
              <div key={i} className="flex gap-3">
                <div className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINT_BG[f.tint]} ${TINT_FG[f.tint]}`}>
                  {f.initials}
                </div>
                <div className="flex-1 rounded-[10px] border border-line bg-surface p-3.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-[12.5px] font-bold">{f.author}</span>
                    <span className="text-[11.5px] text-text-faint">{f.time}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{f.content}</p>
                </div>
              </div>
            ))}
            {feedback.length === 0 && (
              <p className="text-[12.5px] text-text-faint">Chưa có bình luận nào.</p>
            )}
            <div className="flex items-start gap-2.5">
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                {ROLE_INITIALS[role]}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Viết bình luận…"
                  className="min-h-[64px] w-full rounded-[10px] border border-line p-2.5 text-[13px]"
                />
                <button
                  disabled={!commentText.trim()}
                  onClick={() => {
                    addProjectFeedback(project.code, commentText.trim());
                    setCommentText("");
                  }}
                  className="inline-flex h-[38px] items-center justify-center self-end rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {PROJECT_ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4.5 py-3.5 last:border-b-0">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINT_BG[a.tint]} ${TINT_FG[a.tint]}`}>
                  {a.initials}
                </div>
                <div className="flex-1 text-[13px]">
                  <strong>{a.actor}</strong> <span className="text-text-muted">{a.action}</span>
                </div>
                <div className="whitespace-nowrap text-xs text-text-faint">{a.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        danger={hardDelete}
        title={hardDelete ? "Xóa dự án?" : "Đóng dự án?"}
        description={
          hardDelete
            ? `"${project.name}" chưa có sản phẩm nào — xóa sẽ mất hoàn toàn, không khôi phục được.`
            : `"${project.name}" đã có hoạt động — sẽ chuyển sang trạng thái Closed và giữ nguyên lịch sử, không xóa dữ liệu.`
        }
        confirmLabel={hardDelete ? "Xóa" : "Đóng dự án"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (hardDelete) {
            deleteProject(project.code);
            router.push("/projects");
          } else {
            closeProject(project.code);
          }
          setConfirmOpen(false);
        }}
      />

      <EditProjectModal
        key={project.code}
        open={editOpen}
        project={project}
        onCancel={() => setEditOpen(false)}
        onSave={(patch) => {
          updateProject(project.code, patch);
          setEditOpen(false);
        }}
      />

      {quickViewItem && quickViewProduct && (
        <ProjectProductQuickView
          item={quickViewItem}
          product={quickViewProduct}
          isClosed={isClosed}
          canReviewHere={quickViewCanReviewHere}
          canResubmit={quickViewCanResubmit}
          canRelease={quickViewCanRelease}
          showExclusiveToggle={quickViewShowExclusiveToggle}
          onApprove={() => approveProjectProduct(project.code, quickViewItem.productCode)}
          onRequestChange={(reason) => rejectProjectProduct(project.code, quickViewItem.productCode, reason)}
          onResubmit={() => resubmitProjectProduct(project.code, quickViewItem.productCode)}
          onRelease={() => releaseToLibrary(quickViewProduct.code, project.name)}
          onToggleExclusive={() =>
            setReusePermission(
              quickViewProduct.code,
              quickViewProduct.reuse === "EXCLUSIVE" ? "REUSABLE" : "EXCLUSIVE",
              userName,
            )
          }
          onClose={() => setQuickViewCode(null)}
        />
      )}

      {newDesignOpen && (
        <NewProductModal
          open
          title="Thiết kế sản phẩm mới cho dự án"
          projectCustomer={project.customer}
          onCancel={() => setNewDesignOpen(false)}
          onCreate={(code) => {
            addProductToProject(project.code, code, "NEW", role === "RND" ? userName : undefined);
            setNewDesignOpen(false);
          }}
        />
      )}
    </div>
  );
}
