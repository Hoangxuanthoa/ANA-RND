"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditProjectModal } from "@/components/EditProjectModal";
import { NewProjectModal } from "@/components/NewProjectModal";
import { CURRENT_USER_NAME, nextProjectCode, todayDDMMYYYY, type Project, type ProjectStatus } from "@/lib/mock-data";
import { projectStatusBadge, projectTypeBadge } from "@/lib/badges";
import { canCreateProject, canEditProject, canHardDeleteProject, canMarkCompleted, isMyProject } from "@/lib/permissions";

type Scope = "mine" | "all";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { key: ProjectStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CREATED", label: "Created" },
  { key: "DEVELOPING", label: "Developing" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CLOSED", label: "Closed" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-[30px] rounded-full border px-3.5 text-[12.5px] font-semibold ${
        active
          ? "border-text bg-text text-white"
          : "border-line bg-surface text-text-muted hover:border-text-faint hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProjectsPage() {
  const { role } = useRole();
  const { projects, projectProducts, closeProject, markCompleted, deleteProject, updateProject, createProject } = useProjects();
  const userName = CURRENT_USER_NAME[role];
  const isCustomer = role === "CUSTOMER";
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [removeTarget, setRemoveTarget] = useState<Project | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  // Admin oversees everything so defaults to the full list; everyone else
  // (Sales/Marketing created it, R&D is assigned to it) mostly cares about
  // their own, so they default to "mine" — re-defaulting whenever the
  // role switches, since that's effectively "logging in as" someone else.
  const [scope, setScope] = useState<Scope>(role === "ADMIN" ? "all" : "mine");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setScope(role === "ADMIN" ? "all" : "mine");
    setPage(1);
  }, [role]);

  // Scoped by My/All (or Customer's own projects) but not yet by status —
  // this is what the status chips' counts are based on, so switching
  // scope updates the counts but picking a status chip doesn't (a chip's
  // own count shouldn't change just because it's the one selected).
  const scoped = useMemo(() => {
    if (isCustomer) return projects.filter((p) => p.isMine);
    return scope === "mine" ? projects.filter((p) => isMyProject(role, userName, p)) : projects;
  }, [projects, isCustomer, scope, role, userName]);

  const filtered = useMemo(
    () => (status === "ALL" ? scoped : scoped.filter((p) => p.status === status)),
    [scoped, status],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const mineCount = useMemo(
    () => projects.filter((p) => isMyProject(role, userName, p)).length,
    [projects, role, userName],
  );

  // minmax(0, Nfr) — not bare Nfr — on every track: the header row and
  // each data row are separate grid containers, so without the 0 floor a
  // track's width is driven by that row's own content (a status pill
  // forces its column wider than the plain header text in the same
  // position), and header/data columns drift out of alignment.
  //
  // The trailing actions column can't be a bare "auto" either, for the
  // same reason at the row level: the header's action cell is an empty
  // placeholder (~0 content width) while a data row's has up to 3 icons
  // (~96px). auto sizes to content first, before fr tracks split what's
  // left — so the header row would have more leftover space than data
  // rows, and every fr column before it would end up wider in the header,
  // drifting more and more as you move right. A fixed width sidesteps
  // that entirely since it doesn't depend on content either way.
  const gridCols = isCustomer
    ? "grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)]"
    : "grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_100px]";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between border-b border-line">
          {isCustomer ? (
            <div />
          ) : (
            <div className="flex gap-6">
              <button
                onClick={() => {
                  setScope("mine");
                  setPage(1);
                }}
                className={`h-[38px] border-b-2 text-[13.5px] font-bold ${
                  scope === "mine" ? "border-accent text-text" : "border-transparent text-text-faint"
                }`}
              >
                My Project ({mineCount})
              </button>
              <button
                onClick={() => {
                  setScope("all");
                  setPage(1);
                }}
                className={`h-[38px] border-b-2 text-[13.5px] font-bold ${
                  scope === "all" ? "border-accent text-text" : "border-transparent text-text-faint"
                }`}
              >
                All Project ({projects.length})
              </button>
            </div>
          )}
          {canCreateProject(role) && (
            <button
              onClick={() => setNewProjectOpen(true)}
              className="mb-2 inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Project
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const count = s.key === "ALL" ? scoped.length : scoped.filter((p) => p.status === s.key).length;
            return (
              <Chip
                key={s.key}
                active={status === s.key}
                onClick={() => {
                  setStatus(s.key);
                  setPage(1);
                }}
              >
                {s.label} ({count})
              </Chip>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className={`grid ${gridCols} items-center gap-2 bg-bg px-4 py-3.5 text-[11px] font-bold tracking-wide text-text-faint uppercase`}>
            <span>Project</span>
            <span>Type</span>
            <span>Customer</span>
            {!isCustomer && (
              <>
                <span>Sales</span>
                <span>R&amp;D Owner</span>
              </>
            )}
            <span>Ngày tạo</span>
            <span>Status</span>
            <span>Deadline</span>
            <span className="text-right">Products</span>
            {!isCustomer && <span />}
          </div>
          {pageItems.map((p) => {
            const badge = projectStatusBadge(p.status);
            const typeBadge = projectTypeBadge(p.type);
            const editable = canEditProject(role, userName, p);
            const hardDelete = canHardDeleteProject(p);
            const productCount = projectProducts.filter((pp) => pp.projectCode === p.code).length;
            return (
              <div key={p.code} className={`grid ${gridCols} items-center gap-2 border-t border-line px-4 py-3.5 hover:bg-bg`}>
                <Link href={`/projects/${p.code}`}>
                  <div className="text-[13.5px] font-bold">{p.name}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">{p.code}</div>
                </Link>
                <span className={typeBadge.className}>{typeBadge.label}</span>
                <span className="text-[13px] text-text-muted">{p.customer ?? "—"}</span>
                {!isCustomer && (
                  <>
                    <span className="text-[13px] text-text-muted">{p.sales ?? "—"}</span>
                    <span className="text-[13px] text-text-muted">{p.rndOwner ?? "—"}</span>
                  </>
                )}
                <span className="text-[13px] text-text-muted">{p.createdAt}</span>
                <span className={badge.className}>{badge.label}</span>
                <span className="text-[13px] text-text-muted">{p.deadline}</span>
                <span className="text-right text-[13px] font-bold">{productCount}</span>
                {!isCustomer && (
                  <span className="flex justify-end gap-1.5">
                    {editable ? (
                      <button
                        onClick={() => setEditTarget(p)}
                        title="Sửa"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                    ) : (
                      <span className="h-7 w-7" />
                    )}
                    {editable && canMarkCompleted(role, userName, p) && p.status === "DEVELOPING" ? (
                      <button
                        onClick={() => markCompleted(p.code)}
                        title="Đánh dấu Hoàn thành"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-green-soft hover:text-green"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </button>
                    ) : (
                      <span className="h-7 w-7" />
                    )}
                    {editable && p.status !== "CLOSED" ? (
                      <button
                        onClick={() => setRemoveTarget(p)}
                        title={hardDelete ? "Xóa" : "Đóng"}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-red-soft hover:text-red"
                      >
                        {hardDelete ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M9 12l2 2 4-4" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <span className="h-7 w-7" />
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-text-faint">Không có dự án ở trạng thái này.</div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-center gap-2 pt-2">
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
      </div>

      {removeTarget && (
        <ConfirmDialog
          open
          danger={canHardDeleteProject(removeTarget)}
          title={canHardDeleteProject(removeTarget) ? "Xóa dự án?" : "Đóng dự án?"}
          description={
            canHardDeleteProject(removeTarget)
              ? `"${removeTarget.name}" chưa có sản phẩm nào — xóa sẽ mất hoàn toàn, không khôi phục được.`
              : `"${removeTarget.name}" đã có hoạt động — sẽ chuyển sang trạng thái Closed và giữ nguyên lịch sử, không xóa dữ liệu.`
          }
          confirmLabel={canHardDeleteProject(removeTarget) ? "Xóa" : "Đóng dự án"}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => {
            if (canHardDeleteProject(removeTarget)) deleteProject(removeTarget.code);
            else closeProject(removeTarget.code);
            setRemoveTarget(null);
          }}
        />
      )}

      {editTarget && (
        <EditProjectModal
          key={editTarget.code}
          open
          project={editTarget}
          onCancel={() => setEditTarget(null)}
          onSave={(patch) => {
            updateProject(editTarget.code, patch);
            setEditTarget(null);
          }}
        />
      )}

      {newProjectOpen && (
      <NewProjectModal
        open
        role={role}
        onCancel={() => setNewProjectOpen(false)}
        onCreate={(input) => {
          createProject({
            code: nextProjectCode(input.type, projects),
            name: input.name,
            type: input.type,
            customer: input.customer,
            sales: input.sales,
            rndOwner: input.rndOwner,
            // A Customer request is owned by the Sales rep it's routed
            // to from the start — the customer submitted it, but Sales
            // manages it going forward (edit, assign R&D, etc.).
            createdByName: role === "CUSTOMER" ? (input.sales ?? userName) : userName,
            createdAt: todayDDMMYYYY(),
            status: "CREATED",
            deadline: input.deadline,
            brief: input.brief,
            isMine: input.customer === CURRENT_USER_NAME.CUSTOMER,
            attachments: input.attachments,
          });
          setNewProjectOpen(false);
        }}
      />
      )}
    </div>
  );
}
