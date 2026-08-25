"use client";

import { ROLE_INITIALS, type ProjectProductItem } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import {
  usageBadge,
  projectProductStatusBadge,
  customerApprovalBadge,
  TINT_BG,
  TINT_FG,
} from "@/lib/badges";
import { isCustomer as isCustomerRole } from "@/lib/permissions";

interface ProjectProductQuickViewProps {
  item: ProjectProductItem;
  isClosed: boolean;
  onClose: () => void;
}

export function ProjectProductQuickView({ item, isClosed, onClose }: ProjectProductQuickViewProps) {
  const { role } = useRole();
  const customer = isCustomerRole(role);
  const usage = usageBadge(item.usage);
  const status = projectProductStatusBadge(item.status);
  const approval = customerApprovalBadge(item.approval);
  const showCustomerActions =
    !isClosed && customer && item.approval === "PENDING" && item.status === "CUSTOMER_REVIEW";
  const showWatchOnly =
    !isClosed && !customer && item.approval === "PENDING" && item.status === "CUSTOMER_REVIEW";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="flex gap-4">
            <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[10px] ${TINT_BG[item.tint]}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={TINT_FG[item.tint]} stroke="currentColor" strokeWidth="1.5">
                <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                <path d="M3 8v8l9 5 9-5V8" />
                <path d="M12 13v8" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold">{item.name}</h2>
              <div className="mt-0.5 text-xs font-semibold text-text-faint">{item.code}</div>
              <div className="mt-2 flex gap-1.5">
                <span className={usage.className}>{usage.label}</span>
                <span className={status.className}>{status.label}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {item.note && <p className="text-[12.5px] leading-relaxed text-text-muted">{item.note}</p>}

          <div className="flex items-center justify-between rounded-lg bg-bg px-3.5 py-2.5">
            <span className={approval.className}>{approval.label}</span>
            <div className="flex gap-2">
              {showCustomerActions && (
                <>
                  <button className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-white">
                    Request Change
                  </button>
                  <button className="h-8 rounded-md bg-green px-3 text-[12px] font-bold text-white hover:opacity-90">
                    Approve
                  </button>
                </>
              )}
              {showWatchOnly && (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-text-faint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Đang chờ khách duyệt
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-extrabold">Feedback ({item.feedback.length})</h3>
            {item.feedback.length === 0 && (
              <p className="text-[12.5px] text-text-faint">Chưa có feedback nào cho sản phẩm này.</p>
            )}
            {item.feedback.map((f, i) => (
              <div key={i} className="flex gap-2.5">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${TINT_BG[f.tint]} ${TINT_FG[f.tint]}`}>
                  {f.initials}
                </div>
                <div className="flex-1 rounded-[10px] bg-bg p-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-[12px] font-bold">{f.author}</span>
                    <span className="text-[11px] text-text-faint">{f.time}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed">{f.content}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2.5 pt-1">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-white">
                {ROLE_INITIALS[role]}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <textarea
                  placeholder="Viết bình luận cho sản phẩm này…"
                  className="min-h-[56px] w-full rounded-[10px] border border-line p-2.5 text-[12.5px]"
                />
                <button className="inline-flex h-8 items-center justify-center self-end rounded-lg bg-accent px-3.5 text-[12px] font-bold text-white hover:bg-accent-hover">
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
