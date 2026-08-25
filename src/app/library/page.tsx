"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { ProductQuickView } from "@/components/ProductQuickView";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { CATEGORIES, MATERIALS, type Product, type ReusePermission } from "@/lib/mock-data";
import { productStatusBadge, reusePermissionBadge, TINT_BG, TINT_FG } from "@/lib/badges";
import { canCreateProduct, canViewLibrary } from "@/lib/permissions";

const REUSE_OPTIONS: { key: ReusePermission | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "REUSABLE", label: "Reusable" },
  { key: "REFERENCE_ONLY", label: "Reference Only" },
  { key: "EXCLUSIVE", label: "Exclusive" },
];

function FilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 items-center rounded-md px-2.5 text-left text-[13px] font-semibold ${
        active ? "bg-accent-soft text-accent-soft-text" : "text-text-muted hover:bg-bg hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-4">
      <h3 className="mb-1 text-[11px] font-bold tracking-wide text-text-faint uppercase">{title}</h3>
      {children}
    </div>
  );
}

export default function LibraryPage() {
  const { role } = useRole();
  const { products } = useProducts();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [material, setMaterial] = useState<string>("ALL");
  const [reuse, setReuse] = useState<ReusePermission | "ALL">("ALL");
  const [quickView, setQuickView] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (material !== "ALL" && p.material !== material) return false;
      if (reuse !== "ALL" && p.reuse !== reuse) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [products, query, category, material, reuse]);

  if (!canViewLibrary(role)) {
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
            Design Library nội bộ dành cho R&amp;D, Sales và Admin. Bạn chỉ xem được sản phẩm
            được chia sẻ trong dự án của mình.
          </p>
          <Link
            href="/projects"
            className="mt-1.5 inline-flex h-[38px] items-center rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover"
          >
            Xem dự án của bạn
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-7 p-7">
        {/* Sidebar */}
        <aside className="flex w-[240px] flex-shrink-0 flex-col gap-4">
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-faint)"
              strokeWidth="2"
              className="absolute top-1/2 left-3 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sản phẩm…"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </div>

          <FilterGroup title="Category">
            <FilterOption active={category === "ALL"} onClick={() => setCategory("ALL")}>All</FilterOption>
            {CATEGORIES.map((c) => (
              <FilterOption key={c} active={category === c} onClick={() => setCategory(c)}>{c}</FilterOption>
            ))}
          </FilterGroup>

          <FilterGroup title="Material">
            <FilterOption active={material === "ALL"} onClick={() => setMaterial("ALL")}>All</FilterOption>
            {MATERIALS.map((m) => (
              <FilterOption key={m} active={material === m} onClick={() => setMaterial(m)}>{m}</FilterOption>
            ))}
          </FilterGroup>

          <div className="flex flex-col gap-1">
            <h3 className="mb-1 text-[11px] font-bold tracking-wide text-text-faint uppercase">Reuse</h3>
            {REUSE_OPTIONS.map((r) => (
              <FilterOption key={r.key} active={reuse === r.key} onClick={() => setReuse(r.key)}>{r.label}</FilterOption>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-[22px] font-extrabold">Design Library</h1>
              <p className="text-[13.5px] text-text-muted">{filtered.length} sản phẩm</p>
            </div>
            {canCreateProduct(role) && (
              <button className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Sản phẩm mới
              </button>
            )}
          </div>

          <div className="grid grid-cols-5 gap-4">
            {filtered.map((p) => {
              const status = productStatusBadge(p.status);
              const reuseBadge = reusePermissionBadge(p.reuse);
              return (
                <button
                  key={p.code}
                  onClick={() => setQuickView(p)}
                  className="overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`relative flex h-32 items-center justify-center ${TINT_BG[p.tint]}`}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.4">
                      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                      <path d="M3 8v8l9 5 9-5V8" />
                      <path d="M12 13v8" />
                    </svg>
                    <span className={`absolute top-2 left-2 ${reuseBadge.className} bg-white/90 backdrop-blur-sm`}>
                      {reuseBadge.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-bold">{p.name}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-text-faint">{p.code}</div>
                      </div>
                      <span className={status.className}>{status.label}</span>
                    </div>
                    <div className="truncate text-[11px] text-text-muted">
                      {p.category} · {p.material}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-text-faint">
              Không tìm thấy sản phẩm phù hợp bộ lọc.
            </div>
          )}
        </div>
      </div>

      {quickView && <ProductQuickView product={quickView} onClose={() => setQuickView(null)} />}
    </div>
  );
}
