"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/mock-data";
import { formatSizeVariantDimensions } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { productStatusBadge, reusePermissionBadge, TINT_BG, TINT_FG } from "@/lib/badges";
import { canManageProduct, canPickProduct, canManageCollections, canReviewProducts, getPickableProjects } from "@/lib/permissions";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { ImageLightbox } from "@/components/ImageLightbox";
import { RejectProductModal } from "@/components/RejectProductModal";
import { UploadVersionModal } from "@/components/UploadVersionModal";
import { useExclusiveGuard } from "@/components/useExclusiveGuard";

interface ProductQuickViewProps {
  product: Product;
  onClose: () => void;
}

export function ProductQuickView({ product, onClose }: ProductQuickViewProps) {
  const { role, effectiveUserName } = useRole();
  const { favoritedCodes, toggleFavorite, approveProduct, rejectProduct, addProductVersion } = useProducts();
  const { projects, projectProducts, addProductToProject } = useProjects();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [uploadVersionOpen, setUploadVersionOpen] = useState(false);
  const { guardPick, guardModal } = useExclusiveGuard(effectiveUserName);

  const status = productStatusBadge(product.status);
  const reuse = reusePermissionBadge(product.reuse);
  const isFavorited = favoritedCodes.has(product.code);
  // product.favorites is a real per-user aggregate now (ProductFavorite
  // rows), already including your own favorite if isFavorited is true —
  // no "+1" compensation needed like the old mock/session-only count did.
  const favoriteCount = product.favorites;
  const reusedCount = projectProducts.filter((pp) => pp.productCode === product.code && pp.usage === "REUSE").length;
  const isReleased = product.status === "RELEASED";
  const pickableProjects = getPickableProjects(role, effectiveUserName, projects);
  const canReview = canReviewProducts(role) && product.status === "PENDING_REVIEW";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[880px] flex-col rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <div className="mb-2 flex gap-2">
              <span className={status.className}>{status.label}</span>
              <span className={reuse.className}>{reuse.label}</span>
            </div>
            <div className="flex items-start gap-3">
              <div>
                <h2 className="text-lg font-extrabold">{product.name}</h2>
                <div className="mt-0.5 text-[13px] font-semibold text-text-faint">{product.code}</div>
              </div>
              <button
                onClick={() => toggleFavorite(product.code)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition ${
                  isFavorited
                    ? "border-red bg-red-soft text-red"
                    : "border-line bg-surface text-text-muted hover:border-red hover:text-red"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
                  <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
                </svg>
                {favoriteCount}
              </button>
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

        {canReview && (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-amber-soft px-5 py-3">
            <span className="text-[12.5px] font-bold text-amber">
              {product.sourceProjectName ? `Release từ dự án: ${product.sourceProjectName}` : "Nộp trực tiếp từ Library"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectOpen(true)}
                className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-red-soft hover:text-red"
              >
                Từ chối
              </button>
              <button
                onClick={() => {
                  approveProduct(product.code);
                  onClose();
                }}
                className="h-8 rounded-md bg-green px-3 text-[12px] font-bold text-white hover:opacity-90"
              >
                Approve
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-6 p-5">
          {/* Image — click to zoom when a real photo is set. */}
          <div
            onClick={() => product.mainImage && setZoomOpen(true)}
            className={`group relative flex h-[360px] w-[360px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl ${
              product.mainImage ? "cursor-zoom-in" : ""
            } ${product.mainImage ? "" : TINT_BG[product.tint]}`}
          >
            {product.mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.mainImage} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.2">
                <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                <path d="M3 8v8l9 5 9-5V8" />
                <path d="M12 13v8" />
              </svg>
            )}
            {product.mainImage && (
              <div className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3.5">
            <div>
              {[
                ["Category", product.category],
                ["Material", product.material],
                ["Designer", product.designer],
                ...(product.color ? [["Màu sắc", product.color]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-line py-2 text-[13px]">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
              {(product.sizeVariants ?? []).map((v, i) => (
                <div key={`size-${i}`} className="flex justify-between border-b border-line py-2 text-[13px]">
                  <span className="text-text-muted">Size {v.size}</span>
                  <span className="font-semibold">{formatSizeVariantDimensions(v) ?? "—"}</span>
                </div>
              ))}
            </div>
            {product.description && (
              <p className="text-[13px] leading-relaxed text-text-muted">{product.description}</p>
            )}
          </div>
        </div>

        <div className="px-5">
          <div className="w-fit rounded-[10px] bg-bg px-4 py-2.5 text-center">
            <div className="text-base font-extrabold">{reusedCount}</div>
            <div className="text-[10px] font-semibold text-text-faint">Reused</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-5">
          <Link
            href={`/library/${product.code}`}
            className="text-[13px] font-bold text-accent hover:text-accent-hover"
          >
            Xem đầy đủ (versions, used-in, feedback) →
          </Link>
          <div className="flex items-center gap-2">
            {addedNotice && <span className="text-[12px] font-semibold text-green">Đã thêm vào {addedNotice}.</span>}
            {canPickProduct(role) && isReleased && (
              <div className="relative">
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
                >
                  Add to Project
                </button>
                {pickerOpen && (
                  <div className="absolute bottom-11 right-0 z-20 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-md">
                    {pickableProjects.length === 0 && (
                      <p className="p-3 text-[12px] text-text-faint">Không có project nào đang mở để thêm.</p>
                    )}
                    {pickableProjects.map((p) => (
                      <button
                        key={p.code}
                        onClick={() => {
                          guardPick(product, () => addProductToProject(p.code, product.code, "REUSE"));
                          setPickerOpen(false);
                          setAddedNotice(p.name);
                          setTimeout(() => setAddedNotice(null), 2500);
                        }}
                        className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-bg"
                      >
                        <span className="text-[12.5px] font-bold">{p.name}</span>
                        <span className="text-[11px] text-text-faint">{p.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {canManageCollections(role) && isReleased && (
              <AddToCollectionButton
                product={product}
                align="right"
                openUp
                className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg"
              />
            )}
            {canManageProduct(role) && isReleased && (
              <button
                onClick={() => setUploadVersionOpen(true)}
                className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg"
              >
                Upload Version
              </button>
            )}
          </div>
        </div>
      </div>

      {zoomOpen && product.mainImage && (
        <ImageLightbox src={product.mainImage} alt={product.name} onClose={() => setZoomOpen(false)} />
      )}

      {rejectOpen && (
        <RejectProductModal
          open
          product={product}
          onCancel={() => setRejectOpen(false)}
          onConfirm={(reason) => {
            rejectProduct(product.code, reason);
            setRejectOpen(false);
            onClose();
          }}
        />
      )}

      {uploadVersionOpen && (
        <UploadVersionModal
          open
          productName={product.name}
          onCancel={() => setUploadVersionOpen(false)}
          onConfirm={async (note, image) => {
            await addProductVersion(product.code, note, image);
            setUploadVersionOpen(false);
          }}
        />
      )}

      {guardModal}
    </div>
  );
}
