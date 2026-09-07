"use client";

import { useState } from "react";
import type { Project } from "@/lib/mock-data";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateInput } from "@/components/DateInput";

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
  const [attachments, setAttachments] = useState<string[]>(project.attachments);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, deadline: deadline.trim() || "—", brief, attachments });
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
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
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
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover"
          >
            Lưu
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmCloseOpen}
        danger
        title="Hủy thao tác?"
        description="Thông tin bạn đang sửa sẽ không được lưu lại. Bạn có chắc muốn thoát không?"
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
