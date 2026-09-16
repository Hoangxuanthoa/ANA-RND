"use client";

import { useEffect, useState } from "react";
import type { ProjectPhoto } from "@/lib/mock-data";

interface PhotoViewerModalProps {
  photos: ProjectPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const ZOOM_STEP = 0.5;
const WHEEL_ZOOM_STEP = 0.15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// A bounded quick-view style modal (matches ProductQuickView's sizing —
// not the earlier full-screen viewer, which the user found too heavy
// just to glance at a photo) with Next/Back + zoom (buttons, and now the
// scroll wheel — clicking +/- repeatedly for every step was the specific
// complaint).
export function PhotoViewerModal({ photos, index, onIndexChange, onClose }: PhotoViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const photo = photos[index];

  useEffect(() => {
    setZoom(1);
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

  if (!photo) return null;

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => {
      const next = z - Math.sign(e.deltaY) * WHEEL_ZOOM_STEP;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
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
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg" title="Đóng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative flex h-[70vh] max-h-[960px] items-center justify-center bg-bg">
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

          <div className="flex h-full w-full items-center justify-center overflow-auto p-6" onWheel={handleWheel}>
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

        {photo.releasedProductCode && (
          <div className="border-t border-line px-4 py-2.5 text-center text-[12.5px] font-semibold text-green">
            Đã release → {photo.releasedProductCode}
          </div>
        )}
      </div>
    </div>
  );
}
