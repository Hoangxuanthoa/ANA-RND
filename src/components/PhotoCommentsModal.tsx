"use client";

import { useState } from "react";
import { initialsFromName, type ProjectPhoto } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { TINT_BG, TINT_FG } from "@/lib/badges";

interface PhotoCommentsModalProps {
  photo: ProjectPhoto | null;
  onAddComment: (content: string) => void;
  onClose: () => void;
}

// Same bounded quick-view sizing and feedback-thread layout as
// ProjectProductQuickView's comment section — a photo in the folder is a
// small, self-contained item, so it gets a small, self-contained modal
// rather than being folded into the (much heavier) photo viewer.
export function PhotoCommentsModal({ photo, onAddComment, onClose }: PhotoCommentsModalProps) {
  const { effectiveUserName } = useRole();
  const [commentText, setCommentText] = useState("");

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.fileName} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-bold" title={photo.fileName}>
                {photo.fileName}
              </div>
              <div className="text-[11.5px] text-text-faint">Bình luận ({photo.comments.length})</div>
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

        <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto p-4">
          {photo.comments.length === 0 && (
            <p className="text-[12.5px] text-text-faint">Chưa có bình luận nào cho ảnh này.</p>
          )}
          {photo.comments.map((c, i) => (
            <div key={i} className="flex gap-2.5">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${TINT_BG[c.tint]} ${TINT_FG[c.tint]}`}>
                {c.initials}
              </div>
              <div className="flex-1 rounded-[10px] bg-bg p-3">
                <div className="flex justify-between gap-2">
                  <span className="text-[12px] font-bold">{c.author}</span>
                  <span className="text-[11px] text-text-faint">{c.time}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 border-t border-line p-4">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-white">
            {initialsFromName(effectiveUserName)}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Viết bình luận cho ảnh này…"
              className="min-h-[56px] w-full rounded-[10px] border border-line p-2.5 text-[12.5px]"
            />
            <button
              disabled={!commentText.trim()}
              onClick={() => {
                onAddComment(commentText.trim());
                setCommentText("");
              }}
              className="inline-flex h-8 items-center justify-center self-end rounded-lg bg-accent px-3.5 text-[12px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
