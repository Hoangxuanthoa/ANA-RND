"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { useRndTasks } from "@/components/RndTasksProvider";
import { AddRndTaskModal } from "@/components/AddRndTaskModal";
import {
  CURRENT_USER_NAME,
  daysUntil,
  parseDDMMYYYY,
  todayDDMMYYYY,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type TaskCategory,
  type TaskPriority,
} from "@/lib/mock-data";
import { taskStatusBadge, taskPriorityBadge } from "@/lib/badges";
import { canViewMyTasks } from "@/lib/permissions";

const TABS = [
  { key: "todo", label: "To do list" },
  { key: "checkin", label: "Check-in" },
] as const;

// Unified shape for a To Do List row — a project the viewer owns
// (rndOwner), one row per project, or an ad-hoc task they added
// themselves. Trạng thái is never stored directly; it's derived per row
// (project: project.status === "COMPLETED"; task: a real completedAt is
// filled in) — see the plan agreed with the user for why (a project can
// have every item approved and still sit "Đang làm" here until Sales/PM
// actually closes it out, nudging R&D to go push for that).
interface TodoRow {
  key: string;
  kind: "project" | "task";
  title: string;
  href?: string;
  category: string;
  priority: TaskPriority;
  isDone: boolean;
  deadline: string;
  daysLeft: number | null;
  requester: string;
  startDate: string;
  completedAt?: string;
  importantNote?: string;
  needsSupport?: string;
  projectCode?: string;
  taskId?: string;
}

const gridCols =
  "grid-cols-[36px_240px_130px_110px_100px_90px_110px_100px_100px_130px_180px_200px_44px]";

function daysLeftLabel(row: TodoRow): { text: string; className: string } {
  if (row.isDone) return { text: "—", className: "text-text-faint" };
  if (row.daysLeft === null) return { text: "—", className: "text-text-faint" };
  if (row.daysLeft < 0) return { text: `Trễ ${-row.daysLeft} ngày`, className: "font-bold text-red" };
  return { text: `${row.daysLeft} ngày`, className: "text-text-muted" };
}

// Staged local text so a keystroke doesn't fire a save (and notification)
// on every character — only on blur / Enter, once the value actually
// changed.
function NeedsSupportCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder="Cần hỗ trợ gì?"
      className="h-8 w-full rounded-md border border-line px-2 text-[12px] focus:border-accent focus:outline-none"
    />
  );
}

export default function MyTasksPage() {
  const { role } = useRole();
  const userName = CURRENT_USER_NAME[role];
  const { projects, updateProject, setProjectNeedsSupport } = useProjects();
  const { rndTasks, addTask, updateTask, deleteTask, setTaskNeedsSupport } = useRndTasks();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todo");
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const checkinRef = useRef<HTMLDivElement>(null);

  if (!canViewMyTasks(role)) {
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
          <p className="max-w-[360px] text-center text-sm text-text-muted">
            &quot;My Task&quot; dành cho R&amp;D và Admin.
          </p>
        </div>
      </div>
    );
  }

  const projectRows: TodoRow[] = projects
    .filter((p) => p.rndOwner === userName)
    .map((p) => ({
      key: `project-${p.code}`,
      kind: "project",
      title: p.name,
      href: `/projects/${p.code}`,
      category: "Thiết kế 3D",
      priority: p.rndPriority ?? "Trung bình",
      isDone: p.status === "COMPLETED",
      deadline: p.deadline,
      daysLeft: daysUntil(p.deadline),
      requester: p.createdByName,
      startDate: p.createdAt,
      completedAt: p.completedAt,
      importantNote: p.rndImportantNote,
      needsSupport: p.rndNeedsSupport,
      projectCode: p.code,
    }));

  const taskRows: TodoRow[] = rndTasks
    .filter((t) => t.ownerName === userName)
    .map((t) => ({
      key: `task-${t.id}`,
      kind: "task",
      title: t.title,
      category: t.category,
      priority: t.priority,
      isDone: !!(t.completedAt && parseDDMMYYYY(t.completedAt)),
      deadline: t.deadline,
      daysLeft: daysUntil(t.deadline),
      requester: t.requester,
      startDate: t.startDate,
      completedAt: t.completedAt,
      importantNote: t.importantNote,
      needsSupport: t.needsSupport,
      taskId: t.id,
    }));

  // Đang làm first (most urgent deadline first within that group) — a
  // long-finished item's old deadline shouldn't float it above active
  // work just because its raw date is further in the past.
  const allRows = [...projectRows, ...taskRows].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
  });
  const rows = tab === "todo" ? allRows : allRows.filter((r) => !r.isDone);

  function handleNeedsSupport(row: TodoRow, value: string) {
    if (row.kind === "project" && row.projectCode) setProjectNeedsSupport(row.projectCode, value);
    if (row.kind === "task" && row.taskId) setTaskNeedsSupport(row.taskId, value);
  }

  function handlePriority(row: TodoRow, value: TaskPriority) {
    if (row.kind === "project" && row.projectCode) updateProject(row.projectCode, { rndPriority: value });
    if (row.kind === "task" && row.taskId) updateTask(row.taskId, { priority: value });
  }

  async function handleExportImage() {
    if (!checkinRef.current) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(checkinRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no blob");
      if (navigator.clipboard && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setExportMsg("Đã copy ảnh — dán (Ctrl+V) vào nhóm chat luôn.");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `checkin-${userName}-${todayDDMMYYYY().replace(/\//g, "-")}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setExportMsg("Trình duyệt không hỗ trợ copy ảnh — đã tải ảnh về máy.");
      }
    } catch {
      setExportMsg("Xuất ảnh thất bại, thử lại nhé.");
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 4000);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between border-b border-line">
          <div className="flex gap-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`h-[42px] border-b-2 text-[13.5px] font-bold ${
                  tab === t.key ? "border-accent text-text" : "border-transparent text-text-faint"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="mb-2 inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Thêm công việc
          </button>
        </div>

        {tab === "todo" && (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <div className={`grid ${gridCols} min-w-fit items-center gap-2 bg-bg px-4 py-3 text-[11px] font-bold tracking-wide text-text-faint uppercase`}>
              <span>STT</span>
              <span>Tên công việc</span>
              <span>Phân loại</span>
              <span>Mức độ</span>
              <span>Trạng thái</span>
              <span>Còn lại</span>
              <span>Người yêu cầu</span>
              <span>Bắt đầu</span>
              <span>Deadline</span>
              <span>Hoàn thành</span>
              <span>Lưu ý quan trọng</span>
              <span>Cần hỗ trợ</span>
              <span />
            </div>
            {rows.map((row, i) => {
              const status = taskStatusBadge(row.isDone);
              const left = daysLeftLabel(row);
              return (
                <div key={row.key} className={`grid ${gridCols} min-w-fit items-center gap-2 border-t border-line px-4 py-2.5 text-[13px]`}>
                  <span className="text-text-faint">{i + 1}</span>
                  {row.href ? (
                    <Link href={row.href} className="truncate font-bold text-accent hover:text-accent-hover">
                      {row.title}
                    </Link>
                  ) : (
                    <span className="truncate font-bold">{row.title}</span>
                  )}
                  {row.kind === "task" ? (
                    <select
                      value={row.category}
                      onChange={(e) => updateTask(row.taskId!, { category: e.target.value as TaskCategory })}
                      className="h-8 rounded-md border border-line bg-surface px-1.5 text-[12px] focus:border-accent focus:outline-none"
                    >
                      {TASK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-text-muted">{row.category}</span>
                  )}
                  <select
                    value={row.priority}
                    onChange={(e) => handlePriority(row, e.target.value as TaskPriority)}
                    className={`h-7 rounded-full border-0 px-2 text-[11px] font-bold focus:outline-none ${taskPriorityBadge(row.priority).className}`}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <span className={status.className}>{status.label}</span>
                  <span className={left.className}>{left.text}</span>
                  <span className="truncate text-text-muted">{row.requester}</span>
                  <span className="text-text-muted">{row.startDate}</span>
                  <span className="text-text-muted">{row.deadline}</span>
                  {row.kind === "task" ? (
                    <input
                      type="text"
                      defaultValue={row.completedAt ?? ""}
                      onBlur={(e) => updateTask(row.taskId!, { completedAt: e.target.value.trim() || undefined })}
                      placeholder="dd/mm/yyyy"
                      className="h-8 w-full rounded-md border border-line px-2 text-[12px] focus:border-accent focus:outline-none"
                    />
                  ) : (
                    <span className="text-text-muted">{row.completedAt ?? "—"}</span>
                  )}
                  <span className="truncate text-text-muted" title={row.importantNote}>
                    {row.importantNote ?? "—"}
                  </span>
                  <NeedsSupportCell value={row.needsSupport ?? ""} onSave={(v) => handleNeedsSupport(row, v)} />
                  {row.kind === "task" ? (
                    <button
                      onClick={() => deleteTask(row.taskId!)}
                      title="Xóa"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-red-soft hover:text-red"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="py-16 text-center text-sm text-text-faint">Chưa có công việc nào.</div>
            )}
          </div>
        )}

        {tab === "checkin" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] text-text-muted">
                {rows.length} việc đang làm — xuất ảnh để dán vào nhóm check-in.
              </p>
              <div className="flex items-center gap-3">
                {exportMsg && <span className="text-[12px] font-semibold text-accent">{exportMsg}</span>}
                <button
                  onClick={handleExportImage}
                  disabled={exporting || rows.length === 0}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  {exporting ? "Đang xuất…" : "Xuất ảnh"}
                </button>
              </div>
            </div>

            <div ref={checkinRef} className="overflow-hidden rounded-xl border border-line bg-white p-5">
              <p className="mb-3 text-[13px] font-bold">
                Check-in — {userName} — {todayDDMMYYYY()}
              </p>
              <div className="grid grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center gap-2 border-b border-line pb-2 text-[11px] font-bold tracking-wide text-text-faint uppercase">
                <span>STT</span>
                <span>Tên công việc</span>
                <span>Người yêu cầu</span>
                <span>Mức độ</span>
                <span>Deadline</span>
              </div>
              {rows.map((row, i) => {
                const priority = taskPriorityBadge(row.priority);
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center gap-2 border-b border-line py-2.5 text-[13px] last:border-b-0"
                  >
                    <span className="text-text-faint">{i + 1}</span>
                    <span className="truncate font-bold">{row.title}</span>
                    <span className="truncate text-text-muted">{row.requester}</span>
                    <span className={priority.className}>{priority.label}</span>
                    <span className="text-text-muted">{row.deadline}</span>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="py-8 text-center text-sm text-text-faint">Không có việc nào đang làm.</p>}
            </div>
          </div>
        )}
      </div>

      <AddRndTaskModal
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onCreate={(input) => {
          addTask({ ...input, ownerName: userName });
          setAddOpen(false);
        }}
      />
    </div>
  );
}
