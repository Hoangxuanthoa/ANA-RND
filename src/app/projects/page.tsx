"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { PROJECTS, type ProjectStatus } from "@/lib/mock-data";
import { projectStatusBadge } from "@/lib/badges";
import { canCreateProject } from "@/lib/permissions";

const STATUS_OPTIONS: { key: ProjectStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "DEVELOPING", label: "Developing" },
  { key: "CUSTOMER_REVIEW", label: "Customer Review" },
  { key: "APPROVED", label: "Approved" },
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
  const isCustomer = role === "CUSTOMER";
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const base = isCustomer ? PROJECTS.filter((p) => p.isMine) : PROJECTS;
    return status === "ALL" ? base : base.filter((p) => p.status === status);
  }, [status, isCustomer]);

  const gridCols = isCustomer
    ? "grid-cols-[2fr_1.2fr_1fr_1fr_0.6fr]"
    : "grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_0.6fr]";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-[22px] font-extrabold">Projects</h1>
            <p className="text-[13.5px] text-text-muted">
              {filtered.length} {isCustomer ? "dự án của bạn" : "dự án"}
            </p>
          </div>
          {canCreateProject(role) && (
            <button className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Project
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <Chip key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className={`grid ${gridCols} items-center gap-2 bg-bg px-4 py-3.5 text-[11px] font-bold tracking-wide text-text-faint uppercase`}>
            <span>Project</span>
            <span>Customer</span>
            {!isCustomer && (
              <>
                <span>Sales</span>
                <span>R&amp;D Owner</span>
              </>
            )}
            <span>Status</span>
            <span>Deadline</span>
            <span className="text-right">Products</span>
          </div>
          {filtered.map((p) => {
            const badge = projectStatusBadge(p.status);
            return (
              <Link
                key={p.code}
                href={`/projects/${p.code}`}
                className={`grid ${gridCols} items-center gap-2 border-t border-line px-4 py-3.5 hover:bg-bg`}
              >
                <div>
                  <div className="text-[13.5px] font-bold">{p.name}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">{p.code}</div>
                </div>
                <span className="text-[13px] text-text-muted">{p.customer}</span>
                {!isCustomer && (
                  <>
                    <span className="text-[13px] text-text-muted">{p.sales}</span>
                    <span className="text-[13px] text-text-muted">{p.rndOwner}</span>
                  </>
                )}
                <span className={badge.className}>{badge.label}</span>
                <span className="text-[13px] text-text-muted">{p.deadline}</span>
                <span className="text-right text-[13px] font-bold">{p.productCount}</span>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-text-faint">Không có dự án ở trạng thái này.</div>
        )}
      </div>
    </div>
  );
}
