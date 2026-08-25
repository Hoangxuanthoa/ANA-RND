"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import {
  PRODUCTS,
  CATEGORIES,
  MATERIALS,
  type ReusePermission,
} from "@/lib/mock-data";
import { productStatusBadge, reusePermissionBadge, TINT_BG, TINT_FG } from "@/lib/badges";
import { canCreateProduct, canViewLibrary } from "@/lib/permissions";

const REUSE_OPTIONS: { key: ReusePermission | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "REUSABLE", label: "Reusable" },
  { key: "REFERENCE_ONLY", label: "Reference Only" },
  { key: "EXCLUSIVE", label: "Exclusive" },
];

function Chip({
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
      className={`h-[30px] rounded-full border px-3.5 text-[12.5px] font-semibold ${
        active
          ? "border-text bg-text text-white"
          : "border-line bg-surface text-text-muted hover:border-text-faint hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function LibraryPage() {
  const { role } = useRole();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [material, setMaterial] = useState<string>("ALL");
  const [reuse, setReuse] = useState<ReusePermission | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (material !== "ALL" && p.material !== material) return false;
      if (reuse !== "ALL" && p.reuse !== reuse) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [query, category, material, reuse]);

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
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 p-7">
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

        <div className="relative flex">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-faint)"
            strokeWidth="2"
            className="absolute top-1/2 left-3.5 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, mã, category, material, designer, khách hàng…"
            className="h-11 flex-1 rounded-[10px] border border-line bg-surface pl-10 pr-3.5 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[88px] text-[11.5px] font-bold text-text-faint">Category</span>
            <Chip active={category === "ALL"} onClick={() => setCategory("ALL")}>All</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[88px] text-[11.5px] font-bold text-text-faint">Material</span>
            <Chip active={material === "ALL"} onClick={() => setMaterial("ALL")}>All</Chip>
            {MATERIALS.map((m) => (
              <Chip key={m} active={material === m} onClick={() => setMaterial(m)}>{m}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[88px] text-[11.5px] font-bold text-text-faint">Reuse</span>
            {REUSE_OPTIONS.map((r) => (
              <Chip key={r.key} active={reuse === r.key} onClick={() => setReuse(r.key)}>{r.label}</Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filtered.map((p) => {
            const status = productStatusBadge(p.status);
            const reuseBadge = reusePermissionBadge(p.reuse);
            return (
              <Link
                key={p.code}
                href={`/library/${p.code}`}
                className="overflow-hidden rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={`relative flex h-40 items-center justify-center ${TINT_BG[p.tint]}`}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.4">
                    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                    <path d="M3 8v8l9 5 9-5V8" />
                    <path d="M12 13v8" />
                  </svg>
                  <span className={`absolute top-2.5 left-2.5 ${reuseBadge.className} bg-white/90 backdrop-blur-sm`}>
                    {reuseBadge.label}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-bold">{p.name}</div>
                      <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">{p.code}</div>
                    </div>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <div className="text-[11.5px] text-text-muted">
                    {p.category} · {p.material}
                  </div>
                  <div className="flex gap-3.5 border-t border-line pt-2">
                    <span className="text-[11px] text-text-faint">
                      <strong className="text-text">{p.presented}</strong> presented
                    </span>
                    <span className="text-[11px] text-text-faint">
                      <strong className="text-text">{p.reused}</strong> reused
                    </span>
                    <span className="text-[11px] text-text-faint">
                      <strong className="text-text">{p.approved}</strong> approved
                    </span>
                  </div>
                </div>
              </Link>
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
  );
}
