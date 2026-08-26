"use client";

import Link from "next/link";
import type { Product } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { productStatusBadge, reusePermissionBadge, TINT_BG, TINT_FG } from "@/lib/badges";
import { canManageProduct, canPickProduct } from "@/lib/permissions";

interface ProductQuickViewProps {
  product: Product;
  onClose: () => void;
}

export function ProductQuickView({ product, onClose }: ProductQuickViewProps) {
  const { role } = useRole();
  const status = productStatusBadge(product.status);
  const reuse = reusePermissionBadge(product.reuse);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[880px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <div className="mb-2 flex gap-2">
              <span className={status.className}>{status.label}</span>
              <span className={reuse.className}>{reuse.label}</span>
            </div>
            <h2 className="text-lg font-extrabold">{product.name}</h2>
            <div className="mt-0.5 text-[13px] font-semibold text-text-faint">{product.code}</div>
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

        <div className="flex gap-6 p-5">
          {/* Image — sized generously now; a click-to-zoom/lightbox can hang off this same box later. */}
          <div
            className={`group relative flex h-[360px] w-[360px] flex-shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl ${TINT_BG[product.tint]}`}
          >
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.2">
              <path d="M21 8l-9-5-9 5 9 5 9-5z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
            <div className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3.5">
            <div>
              {[
                ["Category", product.category],
                ["Material", product.material],
                ["Designer", product.designer],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-line py-2 text-[13px]">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-text-muted">{product.description}</p>
          </div>
        </div>

        <div className="flex gap-2.5 px-5">
          {[
            ["Presented", product.presented],
            ["Reused", product.reused],
            ["Approved", product.approved],
          ].map(([label, value]) => (
            <div key={label} className="flex-1 rounded-[10px] bg-bg p-2.5 text-center">
              <div className="text-base font-extrabold">{value}</div>
              <div className="text-[10px] font-semibold text-text-faint">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 p-5">
          <Link
            href={`/library/${product.code}`}
            className="text-[13px] font-bold text-accent hover:text-accent-hover"
          >
            Xem đầy đủ (versions, used-in, feedback) →
          </Link>
          <div className="flex gap-2">
            {canPickProduct(role) && (
              <button className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover">
                Add to Project
              </button>
            )}
            {canManageProduct(role) && (
              <button className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg">
                Upload Version
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
