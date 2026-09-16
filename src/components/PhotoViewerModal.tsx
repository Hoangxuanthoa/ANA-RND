"use client";

import { useEffect, useRef, useState } from "react";
import { initialsFromName, type FeedbackItem } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { TINT_BG, TINT_FG } from "@/lib/badges";

// Structural, not tied to ProjectPhoto — also reused by
// ProjectProductQuickView to zoom a single product thumbnail, which has
// no fileName/comments/releasedProductCode of its own.
export interface ViewerPhoto {
  fileName: string;
  url: string;
  releasedProductCode?: string;
}

interface PhotoViewerModalProps {
  photos: ViewerPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  // Optional comment thread rendered as a side column next to the
  // image — used when the viewer is opened from a place that already
  // has its own feedback thread (ProjectProductQuickView), so a
  // reviewer can zoom into detail and leave a comment in one place
  // instead of bouncing between two modals.
  comments?: {
    items: FeedbackItem[];
    onAdd: (content: string) => void;
  };
}

const ZOOM_STEP = 0.5;
const WHEEL_ZOOM_STEP = 0.15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// A bounded quick-view style modal (matches ProductQuickView's sizing —
// not the original full-screen viewer, which the user found too heavy
// just to glance at a photo) with Next/Back, zoom (buttons + scroll
// wheel), and a fullscreen toggle for when the bounded size isn't big
// enough. Image area is `flex-1` rather than a fixed height so both the
// bounded and fullscreen modes share the exact same layout — fullscreen
// just removes the outer padding/max-width/rounding and lets it fill
// the viewport instead.
export function PhotoViewerModal({ photos, index, onIndexChange, onClose, comments }: PhotoViewerModalProps) {
  const { effectiveUserName } = useRole();
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const photo = photos[index];

  useEffect(() => {
    setZoom(1);
    setCommentText("");
  }, [index]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange((index + 1) % photos.length);
      else if (e.key === "ArrowLeft") onIndexChange((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, photos.length, onIndexChange, onClose]);

  // A plain React onWheel handler's preventDefault() doesn't reliably
  // stop the page behind the modal from scrolling too — React attaches
  // wheel listeners passively by default, and a passive listener can't
  // block the browser's default scroll. Attaching a real, non-passive
  // native listener is the only way preventDefault actually takes effect.
  useEffect(() => {
    const el = imageAreaRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      setZoom((z) => {
        const next = z - Math.sign(e.deltaY) * WHEEL_ZOOM_STEP;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  if (!photo) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 ${fullscreen ? "" : "p-4"}`}
      // stopPropagation here too: this modal can be stacked on top of
      // another modal (ProjectProductQuickView), and without this, a
      // click on this backdrop bubbles up to the parent modal's own
      // backdrop and closes both at once instead of just this one.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className={`flex w-full flex-col overflow-hidden border-line bg-surface shadow-md ${
          fullscreen ? "h-full max-w-none" : `h-[85vh] max-h-[950px] ${comments ? "max-w-[1650px]" : "max-w-[1400px]"} rounded-xl border`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className="truncate text-[13px] font-semibold">
            {photo.fileName} <span className="text-text-faint">({index + 1}/{photos.length})</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg disabled:opacity-30"
              title="Thu nhỏ"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35M8 11h6" />
              </svg>
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg disabled:opacity-30"
              title="Phóng to"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
              </svg>
            </button>
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg"
              title={fullscreen ? "Thu nhỏ khung xem" : "Xem toàn màn hình"}
            >
              {fullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9V5a2 2 0 012-2h4M21 9V5a2 2 0 00-2-2h-4M3 15v4a2 2 0 002 2h4M21 15v4a2 2 0 01-2 2h-4" />
                </svg>
              )}
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg" title="Đóng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-bg">
            {photos.length > 1 && (
              <button
                onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
                className="absolute left-3 z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/45"
                title="Ảnh trước"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}

            <div ref={imageAreaRef} className="flex h-full w-full items-center justify-center overflow-auto p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.fileName}
                style={{ transform: `scale(${zoom})` }}
                className="max-h-full max-w-full object-contain transition-transform"
              />
            </div>

            {photos.length > 1 && (
              <button
                onClick={() => onIndexChange((index + 1) % photos.length)}
                className="absolute right-3 z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/45"
                title="Ảnh sau"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>

          {comments && (
            <div className="flex w-[300px] flex-shrink-0 flex-col border-l border-line bg-surface">
              <div className="flex-shrink-0 border-b border-line px-4 py-3 text-[13px] font-extrabold">
                Bình luận ({comments.items.length})
              </div>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {comments.items.length === 0 && (
                  <p className="text-[12.5px] text-text-faint">Chưa có bình luận nào.</p>
                )}
                {comments.items.map((f, i) => (
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
              </div>
              <div className="flex flex-shrink-0 items-start gap-2.5 border-t border-line p-4">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-white">
                  {initialsFromName(effectiveUserName)}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Viết bình luận…"
                    className="min-h-[56px] w-full rounded-[10px] border border-line p-2.5 text-[12.5px]"
                  />
                  <button
                    disabled={!commentText.trim()}
                    onClick={() => {
                      comments.onAdd(commentText.trim());
                      setCommentText("");
                    }}
                    className="inline-flex h-8 items-center justify-center self-end rounded-lg bg-accent px-3.5 text-[12px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                  >
                    Gửi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {photo.releasedProductCode && (
          <div className="flex-shrink-0 border-t border-line px-4 py-2.5 text-center text-[12.5px] font-semibold text-green">
            Đã release → {photo.releasedProductCode}
          </div>
        )}
      </div>
    </div>
  );
}
