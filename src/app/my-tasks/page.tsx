"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { useRndTasks } from "@/components/RndTasksProvider";
import { AddRndTaskModal } from "@/components/AddRndTaskModal";
import { DateInput } from "@/components/DateInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CURRENT_USER_NAME,
  STAFF,
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

const PAGE_SIZE = 12;
const PRIORITY_RANK: Record<TaskPriority, number> = { "Trọng tâm": 0, Cao: 1, "Trung bình": 2, Thấp: 3 };

type StatusFilter = "ALL" | "TODO" | "DONE";
type SourceFilter = "ALL" | "project" | "task";
type SortKey = "deadline" | "priority" | "name";

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
  "grid-cols-[36px_240px_130px_130px_110px_100px_90px_110px_100px_100px_130px_180px_200px_44px]";

function daysLeftLabel(row: TodoRow): { text: string; className: string } {
  if (row.isDone) return { text: "—", className: "text-text-faint" };
  if (row.daysLeft === null) return { text: "—", className: "text-text-faint" };
  if (row.daysLeft < 0) return { text: `Trễ ${-row.daysLeft} ngày`, className: "font-bold text-red" };
  return { text: `${row.daysLeft} ngày`, className: "text-text-muted" };
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-[30px] rounded-full border px-3.5 text-[12.5px] font-semibold ${
        active ? "border-text bg-text text-white" : "border-line bg-surface text-text-muted hover:border-text-faint hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

// Staged local text so a keystroke doesn't fire a save (and, for "Cần hỗ
// trợ", a notification) on every character — only on blur / Enter, once
// the value actually changed.
function StagedTextCell({
  value,
  onSave,
  placeholder,
  bold,
  keepEmpty,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  bold?: boolean;
  keepEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (!trimmed && !keepEmpty) {
          setDraft(value);
          return;
        }
        if (trimmed !== value) onSave(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder={placeholder}
      className={`h-8 w-full rounded-md border border-line px-2 text-[12px] focus:border-accent focus:outline-none ${bold ? "font-bold text-[13px]" : ""}`}
    />
  );
}

// "⋯" menu for an ad-hoc task row — Chỉnh sửa toggles that row's inline
// edit fields on/off (see isEditing in the table below); Xóa asks the
// caller to confirm before deleting. Closes on outside click, same
// pattern as TopNav's bell/account dropdowns.
function RowActionsMenu({ isEditing, onToggleEdit, onDelete }: { isEditing: boolean; onToggleEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Tùy chọn"
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-8 right-0 z-20 w-36 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-md">
          <button
            onClick={() => {
              onToggleEdit();
              setOpen(false);
            }}
            className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold hover:bg-bg"
          >
            {isEditing ? "Xong" : "Chỉnh sửa"}
          </button>
          <button
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold text-red hover:bg-red-soft"
          >
            Xóa
          </button>
        </div>
      )}
    </div>
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("deadline");
  const [page, setPage] = useState(1);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

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
  // work just because its raw date is further in the past. This is the
  // base order Check-in uses as-is; the To Do List tab re-sorts a
  // filtered copy of it per sortBy below.
  const allRows = [...projectRows, ...taskRows].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
  });
  const checkinRows = allRows.filter((r) => !r.isDone);

  // Status-chip counts reflect every other active filter except status
  // itself (so switching status doesn't change what the other chips'
  // counts mean) — same convention as the Projects list page.
  const preStatusFiltered = allRows.filter((r) => {
    if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
    if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
    if (sourceFilter !== "ALL" && r.kind !== sourceFilter) return false;
    if (query.trim() && !r.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });
  const statusCounts = {
    ALL: preStatusFiltered.length,
    TODO: preStatusFiltered.filter((r) => !r.isDone).length,
    DONE: preStatusFiltered.filter((r) => r.isDone).length,
  };
  const todoFiltered = preStatusFiltered.filter((r) => {
    if (statusFilter === "TODO") return !r.isDone;
    if (statusFilter === "DONE") return r.isDone;
    return true;
  });
  const todoSorted = [...todoFiltered].sort((a, b) => {
    if (sortBy === "name") return a.title.localeCompare(b.title, "vi");
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (sortBy === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
  });
  const totalPages = Math.max(1, Math.ceil(todoSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = todoSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                active={statusFilter === "ALL"}
                onClick={() => {
                  setStatusFilter("ALL");
                  setPage(1);
                }}
              >
                Tất cả ({statusCounts.ALL})
              </Chip>
              <Chip
                active={statusFilter === "TODO"}
                onClick={() => {
                  setStatusFilter("TODO");
                  setPage(1);
                }}
              >
                Đang làm ({statusCounts.TODO})
              </Chip>
              <Chip
                active={statusFilter === "DONE"}
                onClick={() => {
                  setStatusFilter("DONE");
                  setPage(1);
                }}
              >
                Hoàn thành ({statusCounts.DONE})
              </Chip>
              <div className="relative ml-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-faint)"
                  strokeWidth="2"
                  className="absolute top-1/2 left-2.5 -translate-y-1/2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm tên công việc…"
                  className="h-9 w-48 rounded-lg border border-line bg-surface pl-8 pr-3 text-[12.5px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as TaskCategory | "ALL");
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-[12.5px] focus:border-accent focus:outline-none"
              >
                <option value="ALL">Phân loại</option>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as TaskPriority | "ALL");
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-[12.5px] focus:border-accent focus:outline-none"
              >
                <option value="ALL">Mức độ</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value as SourceFilter);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-[12.5px] focus:border-accent focus:outline-none"
              >
                <option value="ALL">Nguồn</option>
                <option value="project">Từ Project</option>
                <option value="task">Tự thêm</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="ml-auto h-9 rounded-lg border border-line bg-surface px-2 text-[12.5px] focus:border-accent focus:outline-none"
              >
                <option value="deadline">Sắp xếp: Deadline gần nhất</option>
                <option value="priority">Sắp xếp: Mức độ cao trước</option>
                <option value="name">Sắp xếp: Tên A-Z</option>
              </select>
            </div>

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
              {pageRows.map((row, i) => {
                const status = taskStatusBadge(row.isDone);
                const left = daysLeftLabel(row);
                const isEditing = row.kind === "task" && editingTaskId === row.taskId;
                return (
                  <div key={row.key} className={`grid ${gridCols} min-w-fit items-center gap-2 border-t border-line px-4 py-2.5 text-[13px]`}>
                    <span className="text-text-faint">{(currentPage - 1) * PAGE_SIZE + i + 1}</span>
                    {row.href ? (
                      <Link href={row.href} className="truncate font-bold text-accent hover:text-accent-hover">
                        {row.title}
                      </Link>
                    ) : isEditing ? (
                      <StagedTextCell value={row.title} onSave={(v) => updateTask(row.taskId!, { title: v })} bold />
                    ) : (
                      <span className="truncate font-bold">{row.title}</span>
                    )}
                    {isEditing ? (
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
                    {isEditing ? (
                      <select
                        value={row.requester}
                        onChange={(e) => updateTask(row.taskId!, { requester: e.target.value })}
                        className="h-8 rounded-md border border-line bg-surface px-1.5 text-[12px] focus:border-accent focus:outline-none"
                      >
                        {STAFF.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="truncate text-text-muted">{row.requester}</span>
                    )}
                    {isEditing ? (
                      <DateInput
                        value={row.startDate}
                        onChange={(v) => updateTask(row.taskId!, { startDate: v })}
                        className="h-8 rounded-md border border-line px-1.5 text-[12px] focus:border-accent focus:outline-none"
                      />
                    ) : (
                      <span className="text-text-muted">{row.startDate}</span>
                    )}
                    {isEditing ? (
                      <DateInput
                        value={row.deadline}
                        onChange={(v) => updateTask(row.taskId!, { deadline: v })}
                        className="h-8 rounded-md border border-line px-1.5 text-[12px] focus:border-accent focus:outline-none"
                      />
                    ) : (
                      <span className="text-text-muted">{row.deadline}</span>
                    )}
                    {isEditing ? (
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
                    <StagedTextCell
                      value={row.needsSupport ?? ""}
                      onSave={(v) => handleNeedsSupport(row, v)}
                      placeholder="Cần hỗ trợ gì?"
                      keepEmpty
                    />
                    {row.kind === "task" ? (
                      <RowActionsMenu
                        isEditing={isEditing}
                        onToggleEdit={() => setEditingTaskId(isEditing ? null : row.taskId!)}
                        onDelete={() => setDeleteTarget({ id: row.taskId!, title: row.title })}
                      />
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
              {pageRows.length === 0 && (
                <div className="py-16 text-center text-sm text-text-faint">Không có công việc nào khớp bộ lọc.</div>
              )}
            </div>

            {todoSorted.length > 0 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg disabled:opacity-40"
                >
                  ← Back
                </button>
                <select
                  value={currentPage}
                  onChange={(e) => setPage(Number(e.target.value))}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-[13px] font-bold focus:border-accent focus:outline-none"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Trang {n}/{totalPages}
                    </option>
                  ))}
                </select>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {tab === "checkin" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] text-text-muted">
                {checkinRows.length} việc đang làm — xuất ảnh để dán vào nhóm check-in.
              </p>
              <div className="flex items-center gap-3">
                {exportMsg && <span className="text-[12px] font-semibold text-accent">{exportMsg}</span>}
                <button
                  onClick={handleExportImage}
                  disabled={exporting || checkinRows.length === 0}
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
              {checkinRows.map((row, i) => {
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
              {checkinRows.length === 0 && <p className="py-8 text-center text-sm text-text-faint">Không có việc nào đang làm.</p>}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        danger
        title="Xóa công việc?"
        description={deleteTarget ? `"${deleteTarget.title}" sẽ bị xóa hoàn toàn, không khôi phục được.` : ""}
        confirmLabel="Xóa"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteTask(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
