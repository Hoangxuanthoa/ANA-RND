"use client";

import { useEffect, useState } from "react";

const ROLES: { key: string; label: string; locked?: boolean; note: string }[] = [
  { key: "ADMIN", label: "Admin", locked: true, note: "Luôn có quyền, không tắt được." },
  { key: "RND", label: "R&D", note: "Mở và chỉnh Cài đặt Bóc tách." },
  { key: "PURCHASING", label: "Mua hàng", note: "Mở và chỉnh Cài đặt Bóc tách." },
];

// "Phân quyền" tab (Admin only): which roles may open and edit Cài đặt Bóc tách.
// Switching one on lets that role open this page and edit the tables in it —
// it changes nothing else about what the role can do. Saves immediately.
export function SettingsAccessTab() {
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/breakdown-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setAllowed(data?.allowedRoles ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(role: string) {
    if (!allowed || saving) return;
    const next = allowed.includes(role) ? allowed.filter((r) => r !== role) : [...allowed, role];
    setSaving(true);
    setError(false);
    try {
      const res = await fetch("/api/breakdown-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedRoles: next }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllowed(data.allowedRoles);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <p className="text-[13px] text-text-faint">Đang tải…</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-surface p-3.5 text-[12.5px] leading-relaxed text-text-muted">
        Chọn vai trò nào được <b>Mở</b> Cài đặt Bóc tách (xem và sửa các bảng như Quy cách hàng đan). Mặc định chỉ Admin. Bật cho một vai trò thì họ thấy nút ⚙ Cài đặt trong
        Bóc tách; tắt đi là họ không vào được nữa.
      </p>
      <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
        {ROLES.map((r) => {
          const on = r.locked || allowed.includes(r.key);
          return (
            <label key={r.key} className={`flex items-center justify-between gap-4 px-4 py-3 ${r.locked ? "opacity-80" : "cursor-pointer"}`}>
              <div>
                <p className="text-[13.5px] font-bold">{r.label}</p>
                <p className="text-[11.5px] text-text-faint">{r.note}</p>
              </div>
              <span className="flex items-center gap-2">
                <span className={`text-[12px] font-bold ${on ? "text-accent" : "text-text-faint"}`}>{on ? "Mở" : "Đóng"}</span>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={r.locked || saving}
                  onChange={() => toggle(r.key)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-[12.5px] font-semibold text-red">Lưu thất bại, thử lại.</p>}
    </div>
  );
}
