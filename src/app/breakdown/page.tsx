"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { canViewBreakdown } from "@/lib/permissions";

type Access = "owner" | "admin" | "shared";

interface BreakdownRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  productNames: string[];
  owner: { id: string; name: string };
  access: Access;
  canEdit: boolean;
  sharedWith: { userId: string; name: string }[];
  sharedCount: number;
}

type Tab = "all" | "mine" | "shared" | "others";

function formatUpdated(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)} giờ trước`;
  if (diffMin < 60 * 24 * 7) return `${Math.round(diffMin / (60 * 24))} ngày trước`;
  return d.toLocaleDateString("vi-VN");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

// Same name → same hue, so a person's avatar keeps its colour across cards.
function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 42%)`;
}

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}

function AccessBadge({ row }: { row: BreakdownRow }) {
  if (row.access === "shared") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">Được chia sẻ · chỉ xem</span>;
  }
  if (row.access === "admin") {
    return <span className="rounded-full bg-bg px-2 py-0.5 text-[10.5px] font-bold text-text-muted">Admin xem</span>;
  }
  return null;
}

export default function BreakdownPage() {
  const { role } = useRole();
  const [rows, setRows] = useState<BreakdownRow[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [sharingRow, setSharingRow] = useState<BreakdownRow | null>(null);

  const allowed = canViewBreakdown(role);
  const isAdmin = role === "ADMIN";

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

  const counts = useMemo(() => {
    const list = rows ?? [];
    return {
      all: list.length,
      mine: list.filter((r) => r.access === "owner").length,
      shared: list.filter((r) => r.access === "shared").length,
      others: list.filter((r) => r.access === "admin").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (tab === "mine" && r.access !== "owner") return false;
      if (tab === "shared" && r.access !== "shared") return false;
      if (tab === "others" && r.access !== "admin") return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.owner.name.toLowerCase().includes(q) || r.productNames.some((n) => n.toLowerCase().includes(q));
    });
  }, [rows, tab, query]);

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
        setTab("all");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Save on Enter/blur, not on every keystroke — avoids a PATCH per character.
  function renameBreakdown(id: string, newName: string) {
    setRenamingId(null);
    const trimmed = newName.trim();
    const current = rows?.find((r) => r.id === id);
    if (!trimmed || !current || trimmed === current.name) return;
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, name: trimmed } : r)) ?? prev);
    fetch(`/api/breakdowns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
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

  const tabs: { key: Tab; label: string; count: number; show: boolean }[] = [
    { key: "all", label: isAdmin ? "Tất cả" : "Tất cả của tôi", count: counts.all, show: true },
    { key: "mine", label: "Của tôi", count: counts.mine, show: true },
    { key: "shared", label: "Được chia sẻ", count: counts.shared, show: !isAdmin || counts.shared > 0 },
    { key: "others", label: "Của người khác", count: counts.others, show: isAdmin },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-extrabold">Bóc tách kỹ thuật</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              {isAdmin ? "Admin xem được toàn bộ hồ sơ của mọi tài khoản." : "Hồ sơ của bạn và những hồ sơ được chia sẻ cho bạn."}
            </p>
          </div>
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="h-9 flex-shrink-0 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold ${
                    tab === t.key ? "bg-accent text-white" : "text-text-muted hover:bg-bg hover:text-text"
                  }`}
                >
                  {t.label}
                  <span className={`text-[11px] ${tab === t.key ? "text-white/80" : "text-text-faint"}`}>{t.count}</span>
                </button>
              ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hồ sơ, sản phẩm, người tạo…"
            className="h-9 w-[300px] max-w-full rounded-lg border border-line bg-surface px-3 text-[12.5px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </div>

        {rows.length === 0 && !creating && (
          <p className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-[13px] text-text-faint">
            Chưa có hồ sơ nào — tạo 1 hồ sơ để bắt đầu thêm sản phẩm bóc tách bên trong.
          </p>
        )}
        {rows.length > 0 && visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-[13px] text-text-faint">Không có hồ sơ nào khớp.</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => (
            <div
              key={row.id}
              className="group relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className={`absolute inset-y-3 left-0 w-[3px] rounded-r ${row.access === "shared" ? "bg-amber-400" : "bg-accent"}`} />

              <div className="flex items-start justify-between gap-2 pl-1">
                <div className="min-w-0 flex-1">
                  {renamingId === row.id ? (
                    <input
                      defaultValue={row.name}
                      autoFocus
                      onBlur={(e) => renameBreakdown(row.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-8 w-full rounded-md border border-accent bg-white px-2 text-[14px] font-bold focus:outline-none"
                    />
                  ) : (
                    <Link href={`/breakdown/${row.id}`} className="block truncate text-[14.5px] font-bold text-text hover:text-accent" title={row.name}>
                      {row.name}
                    </Link>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <AccessBadge row={row} />
                  </div>
                </div>
                {row.canEdit && renamingId !== row.id && (
                  <button
                    type="button"
                    onClick={() => setRenamingId(row.id)}
                    title="Đổi tên"
                    className="flex-shrink-0 rounded-md p-1.5 text-text-faint opacity-0 hover:bg-bg hover:text-text group-hover:opacity-100"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex-1 pl-1">
                {row.productCount === 0 ? (
                  <p className="text-[12px] italic text-text-faint">Chưa có sản phẩm</p>
                ) : (
                  <>
                    <p className="text-[12px] font-semibold text-text-muted">{row.productCount} sản phẩm</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {row.productNames.map((n, i) => (
                        <span key={i} className="max-w-[160px] truncate rounded-md bg-bg px-2 py-0.5 text-[11.5px] text-text-muted" title={n}>
                          {n}
                        </span>
                      ))}
                      {row.productCount > row.productNames.length && (
                        <span className="rounded-md bg-bg px-2 py-0.5 text-[11.5px] text-text-faint">+{row.productCount - row.productNames.length}</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line pl-1 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={row.owner.name} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[11.5px] font-semibold text-text">{row.owner.name}</p>
                    <p className="text-[10.5px] text-text-faint">Cập nhật {formatUpdated(row.updatedAt)}</p>
                  </div>
                </div>
                {row.sharedCount > 0 && row.canEdit && (
                  <div className="flex flex-shrink-0 items-center" title={`Đã chia sẻ cho: ${row.sharedWith.map((s) => s.name).join(", ")}`}>
                    {row.sharedWith.slice(0, 3).map((s) => (
                      <span key={s.userId} className="-ml-1.5 first:ml-0 rounded-full ring-2 ring-surface">
                        <Avatar name={s.name} size={20} />
                      </span>
                    ))}
                    {row.sharedCount > 3 && <span className="ml-1 text-[11px] font-semibold text-text-faint">+{row.sharedCount - 3}</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pl-1">
                <Link
                  href={`/breakdown/${row.id}`}
                  className="flex h-8 flex-1 items-center justify-center rounded-md bg-accent text-[12.5px] font-bold text-white hover:bg-accent-hover"
                >
                  {row.canEdit ? "Mở" : "Xem"}
                </Link>
                {row.canEdit && (
                  <button
                    type="button"
                    onClick={() => setSharingRow(row)}
                    className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[12px] font-bold text-text hover:bg-bg"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                    </svg>
                    Chia sẻ
                  </button>
                )}
                {row.canEdit &&
                  (confirmingId === row.id ? (
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => removeBreakdown(row.id)}
                        className="rounded bg-red px-2 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                      >
                        Xóa thật
                      </button>
                      <button type="button" onClick={() => setConfirmingId(null)} className="text-[11.5px] font-semibold text-text-muted hover:underline">
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(row.id)}
                      title="Xóa"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-text-faint hover:bg-red-soft hover:text-red"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                      </svg>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {sharingRow && (
        <ShareModal
          row={sharingRow}
          onClose={() => setSharingRow(null)}
          onSaved={(sharedWith) => {
            setRows((prev) => prev?.map((r) => (r.id === sharingRow.id ? { ...r, sharedWith, sharedCount: sharedWith.length } : r)) ?? prev);
            setSharingRow(null);
          }}
        />
      )}
    </div>
  );
}

interface Candidate {
  id: string;
  name: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = { RND: "R&D", PURCHASING: "Mua hàng" };

function ShareModal({
  row,
  onClose,
  onSaved,
}: {
  row: BreakdownRow;
  onClose: () => void;
  onSaved: (sharedWith: { userId: string; name: string }[]) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/breakdowns/${row.id}/shares`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { candidates: Candidate[]; sharedUserIds: string[] } | null) => {
        if (cancelled) return;
        if (!data) {
          setError("Không tải được danh sách người dùng.");
          return;
        }
        setCandidates(data.candidates);
        setSelected(new Set(data.sharedUserIds));
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/breakdowns/${row.id}/shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [...selected] }),
      });
      if (!res.ok) {
        setError("Lưu thất bại, thử lại nhé.");
        return;
      }
      const data: { sharedWith: { userId: string; name: string }[] } = await res.json();
      onSaved(data.sharedWith);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Chia sẻ hồ sơ" className="flex max-h-[80vh] w-[440px] max-w-full flex-col gap-4 rounded-xl bg-surface p-5 shadow-xl">
        <div>
          <h2 className="text-[16px] font-extrabold">Chia sẻ hồ sơ</h2>
          <p className="mt-0.5 truncate text-[12.5px] text-text-muted">{row.name}</p>
        </div>
        <p className="rounded-lg bg-bg px-3 py-2 text-[12px] text-text-muted">
          Người được chia sẻ sẽ thấy hồ sơ này và mở xem chi tiết (bản vẽ, BOM, xuất file) nhưng <b>không thể chỉnh sửa hay xóa</b>.
        </p>

        <div className="min-h-[80px] flex-1 overflow-y-auto rounded-lg border border-line">
          {candidates === null && !error && <p className="p-4 text-center text-[12.5px] text-text-faint">Đang tải…</p>}
          {candidates?.length === 0 && <p className="p-4 text-center text-[12.5px] text-text-faint">Chưa có tài khoản R&amp;D / Mua hàng nào khác để chia sẻ.</p>}
          {candidates?.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-bg">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--color-accent,#c2410c)]" />
              <Avatar name={c.name} size={28} />
              <span className="flex-1 truncate text-[13px] font-semibold">{c.name}</span>
              <span className="text-[11px] text-text-faint">{ROLE_LABEL[c.role] ?? c.role}</span>
            </label>
          ))}
        </div>

        {error && <p className="text-[12.5px] font-semibold text-red">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg">
            Hủy
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || candidates === null}
            className="h-9 rounded-lg bg-accent px-4 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
