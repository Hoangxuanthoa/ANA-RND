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
        className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
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

        <div className="flex gap-5 p-5">
          <div className={`flex h-40 w-40 flex-shrink-0 items-center justify-center rounded-xl ${TINT_BG[product.tint]}`}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.4">
              <path d="M21 8l-9-5-9 5 9 5 9-5z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div>
              {[
                ["Category", product.category],
                ["Material", product.material],
                ["Designer", product.designer],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-line py-1.5 text-[12.5px]">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] leading-relaxed text-text-muted">{product.description}</p>
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
