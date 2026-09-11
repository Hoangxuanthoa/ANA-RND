"use client";

import { useState } from "react";
import { DateInput } from "@/components/DateInput";
import { STAFF, TASK_CATEGORIES, TASK_PRIORITIES, todayDDMMYYYY, type TaskCategory, type TaskPriority } from "@/lib/mock-data";

interface AddRndTaskModalProps {
  open: boolean;
  onCancel: () => void;
  onCreate: (input: {
    title: string;
    category: TaskCategory;
    priority: TaskPriority;
    requester: string;
    startDate: string;
    deadline: string;
  }) => void;
}

export function AddRndTaskModal({ open, onCancel, onCreate }: AddRndTaskModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>(TASK_CATEGORIES[0]);
  const [priority, setPriority] = useState<TaskPriority>("Trung bình");
  const [requester, setRequester] = useState(STAFF[0]?.name ?? "");
  const [startDate, setStartDate] = useState(todayDDMMYYYY());
  const [deadline, setDeadline] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadline.trim()) return;
    onCreate({ title: title.trim(), category, priority, requester, startDate, deadline });
    setTitle("");
    setCategory(TASK_CATEGORIES[0]);
    setPriority("Trung bình");
    setRequester(STAFF[0]?.name ?? "");
    setStartDate(todayDDMMYYYY());
    setDeadline("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold">Thêm công việc</h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Tên công việc</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="VD: Vẽ lại bản vẽ kỹ thuật khung ghế"
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Phân loại</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Mức độ</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Người yêu cầu</span>
          <select
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
          >
            {STAFF.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Ngày bắt đầu</span>
            <DateInput
              value={startDate}
              onChange={setStartDate}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">
              Deadline <span className="text-red">*</span>
            </span>
            <DateInput
              value={deadline}
              onChange={setDeadline}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </label>
        </div>

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
            disabled={!title.trim() || !deadline.trim()}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Thêm việc
          </button>
        </div>
      </form>
    </div>
  );
}
