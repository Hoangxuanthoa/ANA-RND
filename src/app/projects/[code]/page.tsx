"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditProjectModal } from "@/components/EditProjectModal";
import { ProjectProductQuickView } from "@/components/ProjectProductQuickView";
import {
  CURRENT_USER_NAME,
  ROLE_INITIALS,
  PROJECT_PRODUCTS,
  PROJECT_FEEDBACK,
  PROJECT_ACTIVITY,
  type ProjectProductItem,
} from "@/lib/mock-data";
import {
  projectStatusBadge,
  usageBadge,
  projectProductStatusBadge,
  customerApprovalBadge,
  TINT_BG,
  TINT_FG,
} from "@/lib/badges";
import { canPickProduct, canEditProject, canHardDeleteProject } from "@/lib/permissions";

const TABS = [
  { key: "products", label: `Product Development (${PROJECT_PRODUCTS.length})` },
  { key: "feedback", label: "General Feedback" },
  { key: "activity", label: "Activity" },
] as const;

export default function ProjectDetailPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { role } = useRole();
  const { projects, closeProject, deleteProject, updateProject } = useProjects();
  const userName = CURRENT_USER_NAME[role];
  const project = projects.find((p) => p.code === params.code);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("products");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quickView, setQuickView] = useState<ProjectProductItem | null>(null);

  if (!project) return notFound();

  const status = projectStatusBadge(project.status);
  const editable = canEditProject(role, userName, project);
  const hardDelete = canHardDeleteProject(project);
  const isClosed = project.status === "CLOSED";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 p-7">
        <div className="text-[13px] text-text-faint">
          <Link href="/projects" className="text-accent hover:text-accent-hover">
            Projects
          </Link>{" "}
          / <span className="text-text">{project.name}</span>
        </div>

        <div className="flex justify-between gap-5 rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold">{project.name}</h1>
              <span className={status.className}>{status.label}</span>
            </div>
            <div className="text-[13px] font-semibold text-text-faint">{project.code}</div>
            <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-text-muted">
              {project.brief}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-4">
            <div className="flex gap-7">
              {[
                ["Customer", project.customer],
                ["Sales", project.sales],
                ["R&D Owner", project.rndOwner],
                ["Deadline", project.deadline],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-text-faint">{label}</span>
                  <span className="text-[13px] font-bold">{value}</span>
                </div>
              ))}
            </div>
            {editable && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditOpen(true)}
                  className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
                >
                  Sửa
                </button>
                {!isClosed && (
                  <button
                    onClick={() => setConfirmOpen(true)}
                    className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold text-red hover:bg-red-soft"
                  >
                    {hardDelete ? "Xóa" : "Đóng dự án"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 border-b border-line">
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

        {tab === "products" && (
          <div className="flex flex-col gap-3.5">
            {isClosed && (
              <div className="rounded-lg border border-line bg-bg px-4 py-2.5 text-[12.5px] font-semibold text-text-faint">
                Dự án đã đóng — chỉ xem, không thao tác được nữa.
              </div>
            )}
            {canPickProduct(role) && !isClosed && (
              <div className="flex justify-end">
                <button className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Pick Product
                </button>
              </div>
            )}

            {PROJECT_PRODUCTS.map((i) => {
              const usage = usageBadge(i.usage);
              const s = projectProductStatusBadge(i.status);
              const approval = customerApprovalBadge(i.approval);
              const needsAttention =
                !isClosed && i.approval === "PENDING" && i.status === "CUSTOMER_REVIEW";

              return (
                <button
                  key={i.code}
                  onClick={() => setQuickView(i)}
                  className="flex gap-4 rounded-xl border border-line bg-surface p-4 text-left transition hover:shadow-md"
                >
                  <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[10px] ${TINT_BG[i.tint]}`}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={TINT_FG[i.tint]} stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                      <path d="M3 8v8l9 5 9-5V8" />
                      <path d="M12 13v8" />
                    </svg>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex justify-between gap-2.5">
                      <div>
                        <div className="text-sm font-bold">{i.name}</div>
                        <div className="mt-0.5 text-xs font-semibold text-text-faint">{i.code}</div>
                      </div>
                      <div className="flex flex-shrink-0 gap-1.5">
                        <span className={usage.className}>{usage.label}</span>
                        <span className={s.className}>{s.label}</span>
                      </div>
                    </div>
                    {i.note && <p className="text-[12.5px] leading-relaxed text-text-muted">{i.note}</p>}
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <span className={approval.className}>{approval.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11.5px] font-semibold text-text-faint">
                          Feedback ({i.feedback.length})
                        </span>
                        {needsAttention && (
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-amber">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Cần duyệt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {tab === "feedback" && (
          <div className="flex max-w-[720px] flex-col gap-4">
            {PROJECT_FEEDBACK.map((f, i) => (
              <div key={i} className="flex gap-3">
                <div className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINT_BG[f.tint]} ${TINT_FG[f.tint]}`}>
                  {f.initials}
                </div>
                <div className="flex-1 rounded-[10px] border border-line bg-surface p-3.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-[12.5px] font-bold">{f.author}</span>
                    <span className="text-[11.5px] text-text-faint">{f.time}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{f.content}</p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2.5">
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                {ROLE_INITIALS[role]}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <textarea
                  placeholder="Viết bình luận…"
                  className="min-h-[64px] w-full rounded-[10px] border border-line p-2.5 text-[13px]"
                />
                <button className="inline-flex h-[38px] items-center justify-center self-end rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover">
                  Gửi
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {PROJECT_ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4.5 py-3.5 last:border-b-0">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINT_BG[a.tint]} ${TINT_FG[a.tint]}`}>
                  {a.initials}
                </div>
                <div className="flex-1 text-[13px]">
                  <strong>{a.actor}</strong> <span className="text-text-muted">{a.action}</span>
                </div>
                <div className="whitespace-nowrap text-xs text-text-faint">{a.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        danger={hardDelete}
        title={hardDelete ? "Xóa dự án?" : "Đóng dự án?"}
        description={
          hardDelete
            ? `"${project.name}" chưa có sản phẩm nào — xóa sẽ mất hoàn toàn, không khôi phục được.`
            : `"${project.name}" đã có hoạt động — sẽ chuyển sang trạng thái Closed và giữ nguyên lịch sử, không xóa dữ liệu.`
        }
        confirmLabel={hardDelete ? "Xóa" : "Đóng dự án"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (hardDelete) {
            deleteProject(project.code);
            router.push("/projects");
          } else {
            closeProject(project.code);
          }
          setConfirmOpen(false);
        }}
      />

      <EditProjectModal
        key={project.code}
        open={editOpen}
        project={project}
        onCancel={() => setEditOpen(false)}
        onSave={(patch) => {
          updateProject(project.code, patch);
          setEditOpen(false);
        }}
      />

      {quickView && (
        <ProjectProductQuickView item={quickView} isClosed={isClosed} onClose={() => setQuickView(null)} />
      )}
    </div>
  );
}
