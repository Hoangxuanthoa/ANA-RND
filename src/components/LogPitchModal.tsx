"use client";

import { useState } from "react";
import { CUSTOMERS } from "@/lib/mock-data";

interface LogPitchModalProps {
  open: boolean;
  // What the user was trying to do when this popped up (Xuất PDF / Lấy
  // link online) — shown so the form reads as "you're about to get this
  // file, who's it for" rather than a random unrelated question.
  actionLabel: string;
  onCancel: () => void;
  onConfirm: (customer: string, note: string) => void;
}

export function LogPitchModal({ open, actionLabel, onCancel, onConfirm }: LogPitchModalProps) {
  const [customer, setCustomer] = useState(CUSTOMERS[0]);
  const [note, setNote] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(customer, note);
    setNote("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-[15px] font-bold">{actionLabel}</h3>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Ghi lại bạn đang chào khách nào trước khi lấy file — để cả team nắm được collection này đã chào ai.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Chào khách nào</span>
          <select
            value={customer}
            autoFocus
            onChange={(e) => setCustomer(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
          >
            {CUSTOMERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Note chi tiết</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Khách phản hồi gì, ghi chú thêm… (không bắt buộc)"
            className="min-h-[80px] rounded-lg border border-line p-3 text-[13px]"
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
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover"
          >
            Xác nhận
          </button>
        </div>
      </form>
    </div>
  );
}
