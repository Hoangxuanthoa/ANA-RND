"use client";

import { useState } from "react";
import type { Project } from "@/lib/mock-data";

interface EditProjectModalProps {
  open: boolean;
  project: Project;
  onSave: (patch: Partial<Project>) => void;
  onCancel: () => void;
}

export function EditProjectModal({ open, project, onSave, onCancel }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [deadline, setDeadline] = useState(project.deadline === "—" ? "" : project.deadline);
  const [brief, setBrief] = useState(project.brief);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, deadline: deadline.trim() || "—", brief });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold">Sửa thông tin dự án</h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Tên dự án</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
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
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}
