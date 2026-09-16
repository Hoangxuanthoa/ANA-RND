"use client";

import { useState } from "react";
import { autoSquareCropBlob } from "@/lib/cropImage";
import { uploadFile } from "@/lib/upload";

interface BulkImageItem {
  id: string;
  name: string;
  preview: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (items: { name: string; mainImage: string }[]) => Promise<void>;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

// Fast intake for a rush project: pick a pile of images, each becomes a
// placeholder product (name from the file name, image auto-cropped to a
// square — no per-image manual crop step, that would defeat the point of
// "bulk"). Real category/material/kích thước are filled in later; see
// NewProductModal's edit mode and the "Thiếu thông tin" flow this feeds.
export function BulkUploadModal({ open, onCancel, onConfirm }: BulkUploadModalProps) {
  const [items, setItems] = useState<BulkImageItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleConfirm() {
    setError("");
    setConfirming(true);
    try {
      await onConfirm(items.map(({ name, preview }) => ({ name, mainImage: preview })));
    } catch {
      setError("Tạo sản phẩm thất bại — thử lại.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleFiles(files: FileList) {
    setProcessing(true);
    setError("");
    const picked = Array.from(files);
    try {
      const results = await Promise.all(
        picked.map(async (file) => {
          const objectUrl = URL.createObjectURL(file);
          const blob = await autoSquareCropBlob(objectUrl);
          const preview = await uploadFile(new File([blob], stripExtension(file.name) + ".jpg", { type: "image/jpeg" }), "products");
          return { id: `${file.name}-${file.lastModified}-${Math.random()}`, name: stripExtension(file.name), preview };
        }),
      );
      setItems((prev) => [...prev, ...results]);
    } catch {
      setError("Tải ảnh lên thất bại — thử lại.");
    } finally {
      setProcessing(false);
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex w-full max-w-[640px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md">
        <div>
          <h3 className="text-[15px] font-bold">Up thiết kế hàng loạt</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
            Mỗi ảnh sẽ thành 1 sản phẩm mới — tên tạm lấy theo tên file, ảnh tự động crop vuông. Cần cập nhật đầy
            đủ thông tin (category/material/kích thước...) trước khi release.
          </p>
        </div>

        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-text-faint hover:border-accent hover:text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-[12.5px] font-semibold">Chọn nhiều ảnh</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {processing && <p className="text-[12.5px] text-text-faint">Đang xử lý ảnh…</p>}
        {error && <p className="text-[12.5px] font-semibold text-red">{error}</p>}

        {items.length > 0 && (
          <div className="grid max-h-[320px] grid-cols-4 gap-3 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span className="truncate text-[11px] text-text-faint">{item.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between gap-2.5">
          <span className="text-[12.5px] text-text-faint">
            {items.length > 0 ? `${items.length} sản phẩm sẽ được tạo` : ""}
          </span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={items.length === 0 || confirming}
              onClick={handleConfirm}
              className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {confirming ? "Đang tạo…" : `Tạo${items.length > 0 ? ` (${items.length})` : ""} sản phẩm`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
