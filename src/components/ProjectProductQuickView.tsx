"use client";

import { useState } from "react";
import { ROLE_INITIALS, type ProjectProductItem, type Product } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { PhotoViewerModal } from "@/components/PhotoViewerModal";
import {
  usageBadge,
  projectProductStatusBadge,
  customerApprovalBadge,
  reusePermissionBadge,
  incompleteInfoBadge,
  TINT_BG,
  TINT_FG,
} from "@/lib/badges";
import { isCustomer as isCustomerRole } from "@/lib/permissions";

interface ProjectProductQuickViewProps {
  item: ProjectProductItem;
  product: Product;
  isClosed: boolean;
  canReviewHere: boolean;
  canResubmit: boolean;
  canRelease: boolean;
  showExclusiveToggle: boolean;
  canEditProduct: boolean;
  onApprove: () => void;
  onRequestChange: (reason: string) => void;
  onResubmit: () => void;
  onRelease: () => void;
  onToggleExclusive: () => void;
  onEditProduct: () => void;
  onClose: () => void;
}

export function ProjectProductQuickView({
  item,
  product,
  isClosed,
  canReviewHere,
  canResubmit,
  canRelease,
  showExclusiveToggle,
  canEditProduct,
  onApprove,
  onRequestChange,
  onResubmit,
  onRelease,
  onToggleExclusive,
  onEditProduct,
  onClose,
}: ProjectProductQuickViewProps) {
  const { role } = useRole();
  const { addProjectProductFeedback } = useProjects();
  const [commentText, setCommentText] = useState("");
  const [requestingChange, setRequestingChange] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const customer = isCustomerRole(role);
  const usage = usageBadge(item.usage);
  const status = projectProductStatusBadge(item.status);
  const approval = customerApprovalBadge(item.approval);
  const reuse = reusePermissionBadge(product.reuse);
  const incomplete = incompleteInfoBadge();
  const showCustomerActions =
    !isClosed && customer && item.approval === "PENDING" && item.status === "CUSTOMER_REVIEW";
  const showWatchOnly =
    !isClosed && !customer && item.approval === "PENDING" && item.status === "CUSTOMER_REVIEW";
  // Creator review (Sales stage) and customer review both resolve to the
  // same action — approve or request a change — just at different stages
  // of the pipeline, so they share this one inline block instead of two
  // separate reject dialogs.
  const showReviewActions = showCustomerActions || canReviewHere;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="flex gap-4">
            <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${product.mainImage ? "" : TINT_BG[product.tint]}`}>
              {product.mainImage ? (
                <button
                  type="button"
                  onClick={() => setImageViewerOpen(true)}
                  className="h-full w-full cursor-zoom-in"
                  title="Xem to ảnh"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.mainImage} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                  <path d="M3 8v8l9 5 9-5V8" />
                  <path d="M12 13v8" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold">{product.name}</h2>
              <div className="mt-0.5 text-xs font-semibold text-text-faint">{product.code}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={usage.className}>{usage.label}</span>
                <span className={status.className}>{status.label}</span>
                <span className={reuse.className}>{reuse.label}</span>
                {product.incomplete && <span className={incomplete.className}>{incomplete.label}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {canRelease && (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-green-soft px-5 py-3">
            <span className="text-[12.5px] font-bold text-green">Đã duyệt xong — sẵn sàng đưa vào Library.</span>
            <button
              onClick={onRelease}
              className="h-8 flex-shrink-0 rounded-md bg-green px-3 text-[12px] font-bold text-white hover:opacity-90"
            >
              Release to Library
            </button>
          </div>
        )}

        {product.incomplete && (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-amber-soft px-5 py-3">
            <span className="text-[12.5px] font-bold text-amber">
              Sản phẩm up hàng loạt — cần cập nhật đầy đủ thông tin trước khi release.
            </span>
            {canEditProduct && (
              <button
                onClick={onEditProduct}
                className="h-8 flex-shrink-0 rounded-md border border-amber/30 bg-white px-3 text-[12px] font-bold text-amber hover:bg-amber-soft"
              >
                Sửa thông tin sản phẩm
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 p-5">
          {item.note && <p className="text-[12.5px] leading-relaxed text-text-muted">{item.note}</p>}

          {item.status === "DEVELOPING" && item.lastRejectionReason && (
            <div className="rounded-lg border border-red-soft bg-red-soft px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-bold text-red">Cần chỉnh sửa</div>
                <div className="flex flex-shrink-0 gap-2">
                  {canEditProduct && (
                    <button
                      onClick={onEditProduct}
                      className="h-7 rounded-md border border-red/30 bg-white px-2.5 text-[11px] font-bold text-red hover:bg-red-soft"
                    >
                      Sửa thông tin sản phẩm
                    </button>
                  )}
                  {canResubmit && (
                    <button
                      onClick={onResubmit}
                      className="h-7 rounded-md border border-red/30 bg-white px-2.5 text-[11px] font-bold text-red hover:bg-red-soft"
                    >
                      Gửi lại duyệt
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text">{item.lastRejectionReason}</p>
            </div>
          )}

          <div className="text-[12px] text-text-muted">
            Phụ trách: <span className="font-semibold text-text">{item.assigneeName ?? "Chưa gán"}</span>
          </div>

          {showExclusiveToggle && (
            <div className="flex items-center justify-between rounded-lg bg-bg px-3.5 py-2.5">
              <span className="text-[12px] text-text-muted">Quyền tái sử dụng</span>
              <button
                onClick={onToggleExclusive}
                className="h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] font-bold hover:bg-white"
              >
                {product.reuse === "EXCLUSIVE" ? "Bỏ Exclusive" : "Gắn Exclusive"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2.5 rounded-lg bg-bg px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <span className={approval.className}>{approval.label}</span>
              <div className="flex gap-2">
                {showReviewActions && !requestingChange && (
                  <>
                    <button
                      onClick={() => setRequestingChange(true)}
                      className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-white"
                    >
                      Yêu cầu chỉnh sửa
                    </button>
                    <button
                      onClick={onApprove}
                      className="h-8 rounded-md bg-green px-3 text-[12px] font-bold text-white hover:opacity-90"
                    >
                      Approve
                    </button>
                  </>
                )}
                {showWatchOnly && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-text-faint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Đang chờ khách duyệt
                  </span>
                )}
              </div>
            </div>
            {showReviewActions && requestingChange && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  autoFocus
                  placeholder="Bạn muốn chỉnh sửa gì?"
                  className="min-h-[64px] w-full rounded-lg border border-line bg-surface p-2.5 text-[12.5px] focus:border-accent focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setRequestingChange(false);
                      setChangeReason("");
                    }}
                    className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-white"
                  >
                    Hủy
                  </button>
                  <button
                    disabled={!changeReason.trim()}
                    onClick={() => {
                      onRequestChange(changeReason.trim());
                      setRequestingChange(false);
                      setChangeReason("");
                    }}
                    className="h-8 rounded-md bg-red px-3 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Gửi yêu cầu
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-extrabold">Feedback ({item.feedback.length})</h3>
            {item.feedback.length === 0 && (
              <p className="text-[12.5px] text-text-faint">Chưa có feedback nào cho sản phẩm này.</p>
            )}
            {item.feedback.map((f, i) => (
              <div key={i} className="flex gap-2.5">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${TINT_BG[f.tint]} ${TINT_FG[f.tint]}`}>
                  {f.initials}
                </div>
                <div className="flex-1 rounded-[10px] bg-bg p-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-[12px] font-bold">{f.author}</span>
                    <span className="text-[11px] text-text-faint">{f.time}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed">{f.content}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2.5 pt-1">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-white">
                {ROLE_INITIALS[role]}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Viết bình luận cho sản phẩm này…"
                  className="min-h-[56px] w-full rounded-[10px] border border-line p-2.5 text-[12.5px]"
                />
                <button
                  disabled={!commentText.trim()}
                  onClick={() => {
                    addProjectProductFeedback(item.projectCode, item.productCode, commentText.trim());
                    setCommentText("");
                  }}
                  className="inline-flex h-8 items-center justify-center self-end rounded-lg bg-accent px-3.5 text-[12px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {imageViewerOpen && product.mainImage && (
        <PhotoViewerModal
          photos={[{ fileName: product.name, url: product.mainImage }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setImageViewerOpen(false)}
        />
      )}
    </div>
  );
}
