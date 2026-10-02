"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { canViewBreakdown } from "@/lib/permissions";

interface BreakdownRow {
  id: string;
  name: string;
  createdAt: string;
  productCount: number;
}

export default function BreakdownPage() {
  const { role } = useRole();
  const [rows, setRows] = useState<BreakdownRow[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allowed = canViewBreakdown(role);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    fetch("/api/breakdowns")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setRows(data);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
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
          <p className="max-w-[360px] text-center text-sm text-text-muted">&quot;Bóc tách kỹ thuật&quot; dành cho Admin, R&amp;D và Mua hàng.</p>
        </div>
      </div>
    );
  }

  async function createBreakdown() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/breakdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const created: BreakdownRow = await res.json();
        setRows((prev) => [created, ...(prev ?? [])]);
        setName("");
        setCreating(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Save on blur, not on every keystroke — same "type freely, persist once
  // you move on" pattern as the rest of this app's inline-rename fields,
  // and avoids firing a PATCH per character.
  function renameBreakdown(id: string, newName: string) {
    if (!newName.trim()) return;
    fetch(`/api/breakdowns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
  }

  async function removeBreakdown(id: string) {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    setConfirmingId(null);
    await fetch(`/api/breakdowns/${id}`, { method: "DELETE" });
  }

  if (rows === null) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <TopNav />
        <div className="flex flex-1 items-center justify-center text-[13px] text-text-faint">Đang tải…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-extrabold">Bóc tách kỹ thuật</h1>
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="h-9 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
            >
              + Tạo mới
            </button>
          )}
        </div>

        {creating && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4">
            <input
              value={name}
              autoFocus
              disabled={submitting}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createBreakdown();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Tên (vd: ANA-ADE-022026)…"
              className="h-9 flex-1 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
            <button
              type="button"
              disabled={submitting || !name.trim()}
              onClick={createBreakdown}
              className="h-9 flex-shrink-0 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? "Đang tạo…" : "Tạo"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCreating(false)}
              className="h-9 flex-shrink-0 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg"
            >
              Hủy
            </button>
          </div>
        )}

        {rows.length === 0 && !creating && (
          <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-[13px] text-text-faint">
            Chưa có hồ sơ nào — tạo 1 hồ sơ để bắt đầu thêm sản phẩm bóc tách bên trong.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3.5">
              <input
                defaultValue={row.name}
                onBlur={(e) => renameBreakdown(row.id, e.target.value)}
                className="h-9 flex-1 rounded-md border border-line bg-white px-2.5 text-[13.5px] font-semibold text-text focus:border-accent focus:outline-none"
              />
              <span className="flex-shrink-0 text-[12px] text-text-faint">{row.productCount} sản phẩm</span>
              <Link
                href={`/breakdown/${row.id}`}
                className="flex h-9 flex-shrink-0 items-center rounded-md bg-accent px-3 text-[12.5px] font-bold text-white hover:bg-accent-hover"
              >
                Mở
              </Link>
              {confirmingId === row.id ? (
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="text-[11.5px] font-semibold text-text-faint">Xóa thật?</span>
                  <button
                    type="button"
                    onClick={() => removeBreakdown(row.id)}
                    className="rounded bg-red px-2 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                  >
                    Xóa
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)} className="text-[11.5px] font-semibold text-text-muted hover:underline">
                    Hủy
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingId(row.id)} className="flex-shrink-0 text-[12px] font-semibold text-red hover:underline">
                  Xóa
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
