"use client";

import { useEffect, useMemo, useState } from "react";

interface ActivityRow {
  id: string;
  kind: string;
  summary: string;
  user: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.slice(0, 2) ?? "?")).toUpperCase();
}

function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 42%)`;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hôm nay";
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

// Right-hand drawer listing a breakdown's edit history (newest first, grouped
// by day). Read-only: it only reports what the server logged.
export function ActivityPanel({ breakdownId, onClose }: { breakdownId: string; onClose: () => void }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/breakdowns/${breakdownId}/activity`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ActivityRow[]) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [breakdownId]);

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityRow[] }[] = [];
    for (const r of rows ?? []) {
      const label = dayLabel(r.updatedAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [rows]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Lịch sử chỉnh sửa" className="flex h-full w-[400px] max-w-full flex-col bg-surface shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-extrabold">Lịch sử chỉnh sửa</h2>
            <p className="text-[11.5px] text-text-faint">Ghi lại từ khi có tính năng này. Sửa liên tục trong 10 phút được gộp thành một dòng.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1 text-[13px] font-semibold text-text-muted hover:bg-bg hover:text-text">
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-[12.5px] font-semibold text-red">Không tải được lịch sử.</p>}
          {!error && rows === null && <p className="text-[12.5px] text-text-faint">Đang tải…</p>}
          {rows?.length === 0 && <p className="rounded-lg border border-dashed border-line p-6 text-center text-[12.5px] text-text-faint">Chưa có chỉnh sửa nào được ghi lại.</p>}

          {groups.map((g) => (
            <div key={g.label} className="mb-5">
              <p className="mb-2 text-[11px] font-bold tracking-wide text-text-muted uppercase">{g.label}</p>
              <ul className="flex flex-col gap-3">
                {g.items.map((r) => {
                  const span = time(r.createdAt) !== time(r.updatedAt) ? `${time(r.createdAt)} – ${time(r.updatedAt)}` : time(r.updatedAt);
                  return (
                    <li key={r.id} className="flex gap-2.5">
                      <span
                        title={r.user.name}
                        style={{ background: avatarColor(r.user.name) }}
                        className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      >
                        {initials(r.user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] leading-snug text-text">
                          <span className="font-bold">{r.user.name}</span> · {r.summary}
                        </p>
                        <p className="text-[11px] text-text-faint">{span}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
