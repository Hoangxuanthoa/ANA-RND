"use client";

import { useState } from "react";

interface RejectProjectProductModalProps {
  open: boolean;
  productName: string;
  productCode: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RejectProjectProductModal({
  open,
  productName,
  productCode,
  onConfirm,
  onCancel,
}: RejectProjectProductModalProps) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-[15px] font-bold">Yêu cầu chỉnh sửa</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            {productName} · {productCode} — sẽ quay lại &quot;Đang phát triển&quot; kèm lý do này.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">
            Lý do <span className="text-red">*</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="VD: Kích thước chưa đúng brief, cần chỉnh lại phần đế…"
            className="min-h-[90px] rounded-lg border border-line p-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!reason.trim()}
            className="h-9 rounded-lg bg-red px-3.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            Yêu cầu chỉnh sửa
          </button>
        </div>
      </form>
    </div>
  );
}
