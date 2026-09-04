"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useCollections } from "@/components/CollectionsProvider";
import { CURRENT_USER_NAME } from "@/lib/mock-data";
import { canManageCollections, isMyCollection } from "@/lib/permissions";

type Scope = "mine" | "all";

export default function CollectionsPage() {
  const { role } = useRole();
  const userName = CURRENT_USER_NAME[role];
  const { collections, createCollection } = useCollections();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  // Admin oversees everything so defaults to the full list; everyone else
  // mostly cares about the collections they made, same default logic as
  // the Projects tab.
  const [scope, setScope] = useState<Scope>(role === "ADMIN" ? "all" : "mine");

  useEffect(() => {
    setScope(role === "ADMIN" ? "all" : "mine");
  }, [role]);

  const filtered = useMemo(
    () => (scope === "mine" ? collections.filter((c) => isMyCollection(userName, c)) : collections),
    [collections, scope, userName],
  );

  if (!canManageCollections(role)) {
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
            Collection dùng để tổng hợp sản phẩm gửi khách hàng / đối tác, không áp dụng cho tài khoản Customer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-[22px] font-extrabold">Collections</h1>
            <p className="text-[13.5px] text-text-muted">
              {filtered.length} collection{scope === "mine" ? " của bạn" : ""}
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Collection
          </button>
        </div>

        {creating && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4">
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  createCollection(name.trim(), userName);
                  setName("");
                  setCreating(false);
                }
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Tên collection…"
              className="h-9 flex-1 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
            <button
              onClick={() => {
                if (!name.trim()) return;
                createCollection(name.trim(), userName);
                setName("");
                setCreating(false);
              }}
              className="h-9 flex-shrink-0 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
            >
              Tạo
            </button>
            <button
              onClick={() => setCreating(false)}
              className="h-9 flex-shrink-0 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg"
            >
              Hủy
            </button>
          </div>
        )}

        <div className="flex gap-6 border-b border-line">
          <button
            onClick={() => setScope("mine")}
            className={`h-[38px] border-b-2 text-[13.5px] font-bold ${
              scope === "mine" ? "border-accent text-text" : "border-transparent text-text-faint"
            }`}
          >
            My Collection
          </button>
          <button
            onClick={() => setScope("all")}
            className={`h-[38px] border-b-2 text-[13.5px] font-bold ${
              scope === "all" ? "border-accent text-text" : "border-transparent text-text-faint"
            }`}
          >
            All Collection
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 bg-bg px-4 py-3.5 text-[11px] font-bold tracking-wide text-text-faint uppercase">
            <span>Collection</span>
            <span>Trạng thái</span>
            <span className="text-right">Sản phẩm</span>
            <span>Tạo bởi</span>
            <span>Ngày tạo</span>
            <span>Đã chào</span>
          </div>
          {filtered.map((c) => {
            const pitchedCustomers = Array.from(new Set(c.pitches.map((p) => p.customer)));
            return (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 border-t border-line px-4 py-3.5 hover:bg-bg"
              >
                <span className="truncate text-[13.5px] font-bold">{c.name}</span>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    c.status === "DRAFT" ? "bg-slate-soft text-slate-text" : "bg-green-soft text-green"
                  }`}
                >
                  {c.status === "DRAFT" ? "Draft" : "Đã gửi"}
                </span>
                <span className="text-right text-[13px] font-bold">{c.productCodes.length}</span>
                <span className="text-[13px] text-text-muted">{c.createdByName}</span>
                <span className="text-[13px] text-text-muted">{c.createdAt}</span>
                <span className="truncate text-[13px] text-text-muted">
                  {pitchedCustomers.length > 0 ? pitchedCustomers.join(", ") : "—"}
                </span>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-text-faint">Chưa có collection nào.</div>
        )}
      </div>
    </div>
  );
}
