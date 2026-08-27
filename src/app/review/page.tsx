"use client";

import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { RejectProductModal } from "@/components/RejectProductModal";
import type { Product } from "@/lib/mock-data";
import { TINT_BG, TINT_FG } from "@/lib/badges";
import { canReviewProducts } from "@/lib/permissions";

export default function ReviewQueuePage() {
  const { role } = useRole();
  const { products, approveProduct, rejectProduct } = useProducts();
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);

  const pending = products.filter((p) => p.status === "PENDING_REVIEW");

  if (!canReviewProducts(role)) {
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
            Duyệt sản phẩm là quyền của Admin (trưởng phòng).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7">
        <div>
          <h1 className="mb-1 text-[22px] font-extrabold">Duyệt sản phẩm</h1>
          <p className="text-[13.5px] text-text-muted">{pending.length} sản phẩm đang chờ duyệt</p>
        </div>

        <div className="flex flex-col gap-3.5">
          {pending.map((p) => (
            <div key={p.code} className="flex gap-4 rounded-xl border border-line bg-surface p-4">
              <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${p.mainImage ? "" : TINT_BG[p.tint]}`}>
                {p.mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mainImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                    <path d="M3 8v8l9 5 9-5V8" />
                    <path d="M12 13v8" />
                  </svg>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex justify-between gap-2.5">
                  <div>
                    <div className="text-sm font-bold">{p.name}</div>
                    <div className="mt-0.5 text-xs font-semibold text-text-faint">{p.code}</div>
                  </div>
                  {p.sourceProjectName ? (
                    <span className="inline-flex h-fit items-center rounded-full bg-blue-soft px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-blue">
                      Từ project: {p.sourceProjectName}
                    </span>
                  ) : (
                    <span className="inline-flex h-fit items-center rounded-full bg-slate-soft px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-slate-text">
                      Upload trực tiếp
                    </span>
                  )}
                </div>

                <div className="text-[12.5px] text-text-muted">
                  {p.category} · {p.material} · Designer: {p.designer}
                </div>

                <div className="flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-[11.5px] text-text-faint">Nộp {p.submittedAt ?? "gần đây"}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRejectTarget(p)}
                      className="h-[34px] rounded-md border border-line bg-surface px-3 text-[12.5px] font-bold hover:bg-red-soft hover:text-red"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => approveProduct(p.code)}
                      className="h-[34px] rounded-md bg-green px-3 text-[12.5px] font-bold text-white hover:opacity-90"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {pending.length === 0 && (
            <div className="py-16 text-center text-sm text-text-faint">
              Không có sản phẩm nào đang chờ duyệt.
            </div>
          )}
        </div>
      </div>

      {rejectTarget && (
        <RejectProductModal
          open
          product={rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            rejectProduct(rejectTarget.code, reason);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
