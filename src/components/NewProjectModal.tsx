"use client";

import { useState } from "react";
import {
  STAFF,
  CUSTOMERS,
  CURRENT_USER_NAME,
  type Role,
  type ProjectType,
} from "@/lib/mock-data";
import { creatableProjectTypes } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateInput } from "@/components/DateInput";

const TYPE_LABEL: Record<ProjectType, string> = {
  CUSTOMER: "Khách hàng",
  INTERNAL: "Nội bộ",
  MARKETING: "Marketing",
};

interface NewProjectModalProps {
  open: boolean;
  role: Role;
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    type: ProjectType;
    customer?: string;
    sales?: string;
    rndOwner?: string;
    deadline: string;
    brief: string;
    attachments: string[];
  }) => void;
}

export function NewProjectModal({ open, role, onCancel, onCreate }: NewProjectModalProps) {
  const types = creatableProjectTypes(role);
  const salesStaff = STAFF.filter((s) => s.role === "SALES");
  const rndStaff = STAFF.filter((s) => s.role === "RND");

  const isCustomer = role === "CUSTOMER";
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>(types[0]);
  const [customer, setCustomer] = useState(isCustomer ? CURRENT_USER_NAME.CUSTOMER : CUSTOMERS[0]);
  const [sales, setSales] = useState(role === "SALES" ? CURRENT_USER_NAME.SALES : salesStaff[0]?.name ?? "");
  // A customer request comes in unassigned — Sales picks it up and
  // assigns R&D themselves (see EditProjectModal), so there's no picker
  // for it here.
  const [rndOwner, setRndOwner] = useState(isCustomer ? "" : rndStaff[0]?.name ?? "");
  const [deadline, setDeadline] = useState("");
  const [brief, setBrief] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      type,
      customer: type === "CUSTOMER" ? customer : undefined,
      sales: type === "CUSTOMER" ? sales : undefined,
      rndOwner: rndOwner || undefined,
      deadline: deadline.trim() || "—",
      brief: brief.trim(),
      attachments,
    });
    setName("");
    setDeadline("");
    setBrief("");
    setAttachments([]);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
      >
        <h3 className="text-[15px] font-bold">{isCustomer ? "Yêu cầu dự án mới" : "Tạo dự án mới"}</h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Tên dự án</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: JYSK Lighting Q1 2027"
            autoFocus
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        {types.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Loại dự án</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        )}

        {type === "CUSTOMER" && (
          <div className="flex gap-3">
            {!isCustomer && (
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Khách hàng</span>
                <select
                  value={customer}
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
            )}
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Sales phụ trách</span>
              <select
                value={sales}
                onChange={(e) => setSales(e.target.value)}
                className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
              >
                {salesStaff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {!isCustomer && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">R&amp;D phụ trách</span>
            <select
              value={rndOwner}
              onChange={(e) => setRndOwner(e.target.value)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              <option value="">Chưa gán</option>
              {rndStaff.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Deadline</span>
          <DateInput
            value={deadline}
            onChange={setDeadline}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Brief</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Mô tả ngắn gọn mục tiêu dự án…"
            className="min-h-[80px] rounded-lg border border-line p-3 text-[13px]"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Tệp / ảnh đính kèm</span>
          {attachments.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {attachments.map((file, i) => (
                <li
                  key={`${file}-${i}`}
                  className="flex items-center justify-between rounded-md bg-bg px-2.5 py-1.5 text-[12.5px]"
                >
                  <span className="truncate">{file}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-2 flex-shrink-0 text-text-faint hover:text-red"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-[12.5px] font-bold hover:bg-bg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12M7 8l5-5 5 5" />
              <path d="M5 21h14" />
            </svg>
            Thêm tệp
            <input type="file" multiple className="hidden" onChange={handleFilePick} />
          </label>
        </div>

        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmCloseOpen(true)}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {isCustomer ? "Gửi yêu cầu" : "Tạo dự án"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmCloseOpen}
        danger
        title="Hủy thao tác?"
        description="Thông tin bạn đang nhập sẽ không được lưu lại. Bạn có chắc muốn thoát không?"
        confirmLabel="Thoát"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onCancel();
        }}
      />
    </div>
  );
}
