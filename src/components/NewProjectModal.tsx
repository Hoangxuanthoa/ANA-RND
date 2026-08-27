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
  }) => void;
}

export function NewProjectModal({ open, role, onCancel, onCreate }: NewProjectModalProps) {
  const types = creatableProjectTypes(role);
  const salesStaff = STAFF.filter((s) => s.role === "SALES");
  const rndStaff = STAFF.filter((s) => s.role === "RND");

  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>(types[0]);
  const [customer, setCustomer] = useState(CUSTOMERS[0]);
  const [sales, setSales] = useState(role === "SALES" ? CURRENT_USER_NAME.SALES : salesStaff[0]?.name ?? "");
  const [rndOwner, setRndOwner] = useState(rndStaff[0]?.name ?? "");
  const [deadline, setDeadline] = useState("");
  const [brief, setBrief] = useState("");

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
    });
    setName("");
    setDeadline("");
    setBrief("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold">Tạo dự án mới</h3>

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

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Deadline</span>
          <input
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            placeholder="dd/mm/yyyy"
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
            disabled={!name.trim()}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Tạo dự án
          </button>
        </div>
      </form>
    </div>
  );
}
