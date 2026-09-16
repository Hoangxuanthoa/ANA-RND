"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import { useCollections } from "@/components/CollectionsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { formatSizeVariantDimensions } from "@/lib/mock-data";
import { TINT_BG, TINT_FG } from "@/lib/badges";

function sizeSummary(sizeVariants?: { size: string; length?: number; width?: number; height?: number }[]) {
  if (!sizeVariants || sizeVariants.length === 0) return "—";
  return sizeVariants
    .map((v) => {
      const dims = formatSizeVariantDimensions(v);
      return dims ? `${v.size} (${dims})` : v.size;
    })
    .join(", ");
}

// Customer-facing view — no TopNav, no role switcher, no internal-only
// info (who created it, pitch history, edit/delete). Anyone with the link
// can view this; there's no real auth in the app yet to gate it behind.
export default function CollectionSharePage() {
  const params = useParams<{ id: string }>();
  const { collections } = useCollections();
  const { products } = useProducts();
  const collection = collections.find((c) => c.id === params.id);

  const items = useMemo(
    () =>
      collection
        ? collection.productCodes.map((code) => products.find((p) => p.code === code)).filter((p): p is NonNullable<typeof p> => !!p)
        : [],
    [collection, products],
  );

  if (!collection) return notFound();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="border-b border-line bg-surface px-7 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Artex Nam An" className="h-7 w-auto self-start" />
      </div>

      <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-7">
        <div>
          <h1 className="text-2xl font-extrabold">{collection.name}</h1>
          <p className="mt-1 text-[13px] text-text-muted">{items.length} sản phẩm</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {items.map((p) => (
            <div key={p.code} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className={`flex aspect-square items-center justify-center overflow-hidden ${p.mainImage ? "" : TINT_BG[p.tint]}`}>
                {p.mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mainImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.4">
                    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                    <path d="M3 8v8l9 5 9-5V8" />
                    <path d="M12 13v8" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <div className="text-[12.5px] font-bold">{p.code}</div>
                <div className="text-[11px] text-text-muted">
                  {p.category} · {p.material}
                </div>
                <div className="text-[11px] text-text-faint">{sizeSummary(p.sizeVariants)}</div>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <p className="py-16 text-center text-sm text-text-faint">Collection này chưa có sản phẩm nào.</p>
        )}

        <p className="mt-auto pt-6 text-center text-[12px] text-text-faint">
          Được chia sẻ bởi Artex Nam An — liên hệ người phụ trách để biết thêm chi tiết.
        </p>
      </div>
    </div>
  );
}
