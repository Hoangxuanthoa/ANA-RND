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
const MAX_ZOOM = 3;

export function PhotoViewerModal({ photos, index, onIndexChange, onClose }: PhotoViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const photo = photos[index];

  // Reset zoom whenever the viewed photo changes, and let arrow/escape
  // keys drive the same Next/Back/Close the on-screen buttons do.
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-5 py-3.5 text-white">
        <div className="text-[13px] font-semibold">
          {photo.fileName} <span className="text-white/50">({index + 1}/{photos.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(1, z - ZOOM_STEP))}
            disabled={zoom <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-30"
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
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-30"
            title="Phóng to"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
            </svg>
          </button>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10" title="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {photos.length > 1 && (
          <button
            onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
            className="absolute left-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Ảnh trước"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className="flex h-full w-full items-center justify-center overflow-auto p-8">
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
            className="absolute right-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Ảnh sau"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {photo.releasedProductCode && (
        <div className="px-5 py-3 text-center text-[12.5px] font-semibold text-green">
          Đã release → {photo.releasedProductCode}
        </div>
      )}
    </div>
  );
}
