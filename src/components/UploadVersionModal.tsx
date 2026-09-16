"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageCropModal } from "@/components/ImageCropModal";

interface UploadVersionModalProps {
  open: boolean;
  productName: string;
  onCancel: () => void;
  onConfirm: (note: string, image?: string) => Promise<void>;
}

export function UploadVersionModal({ open, productName, onCancel, onConfirm }: UploadVersionModalProps) {
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await onConfirm(note.trim(), image);
      setNote("");
      setImage(undefined);
    } catch {
      setError("Lưu version thất bại — thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestClose() {
    if (note.trim() || image) setConfirmCloseOpen(true);
    else onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
      >
        <div>
          <h3 className="text-[15px] font-bold">Upload Version</h3>
          <p className="mt-1 text-[12.5px] text-text-muted">{productName}</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">
            Đã thay đổi gì <span className="text-red">*</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            autoFocus
            placeholder="VD: Gia cố đáy, đổi kiểu đan viền…"
            className="min-h-[90px] rounded-lg border border-line p-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Ảnh chính mới (không bắt buộc)</span>
          {image ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImage(undefined)}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-1.5 text-center text-text-faint hover:border-accent hover:text-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-[11px] font-semibold">Thay ảnh</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCropSrc(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {error && <p className="text-[12.5px] font-semibold text-red">{error}</p>}

        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={requestClose}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!note.trim() || submitting}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {submitting ? "Đang lưu…" : "Lưu version"}
          </button>
        </div>
      </form>

      <ImageCropModal
        open={cropSrc !== null}
        imageSrc={cropSrc ?? ""}
        folder="products"
        onCancel={() => setCropSrc(null)}
        onCropped={(url) => {
          setImage(url);
          setCropSrc(null);
        }}
      />

      <ConfirmDialog
        open={confirmCloseOpen}
        danger
        title="Hủy thao tác?"
        description="Thông tin bạn đang nhập sẽ không được lưu lại. Bạn có chắc muốn thoát không?"
        confirmLabel="Thoát"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onCancel();
        }}
      />
    </div>
  );
}
