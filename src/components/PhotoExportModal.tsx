"use client";

import { useState } from "react";
import type { ProjectPhoto } from "@/lib/mock-data";
import { todayDDMMYYYY } from "@/lib/mock-data";
import { generateCollectionPptx, PRODUCTS_PER_SLIDE_OPTIONS, type ProductsPerSlide } from "@/lib/pptxExport";
import { generateCollectionPdf } from "@/lib/pdfExport";
import type { ExportItem, InfoVisibility } from "@/lib/exportLayout";

// A one-off, image-only PPTX/PDF export straight from a project's raw
// photo folder — deliberately NOT a real Collection (no productCodes to
// point at, no share link, no pitch log): these are un-vetted photos, not
// approved catalog products. See PROGRESS.md for why this stays separate
// from the real Collection export machinery it otherwise reuses in full.
const NO_INFO: InfoVisibility = { code: false, category: false, material: false, dimension: false };

interface PhotoExportModalProps {
  open: boolean;
  photos: ProjectPhoto[];
  projectName: string;
  defaultCustomer?: string;
  onClose: () => void;
}

export function PhotoExportModal({ open, photos, projectName, defaultCustomer, onClose }: PhotoExportModalProps) {
  const [customer, setCustomer] = useState(defaultCustomer ?? "");
  const [perSlide, setPerSlide] = useState<ProductsPerSlide>(2);
  const [pptxBusy, setPptxBusy] = useState(false);
  const [pptxError, setPptxError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  if (!open) return null;

  const items: ExportItem[] = photos.map((p) => ({
    code: "",
    category: "",
    material: "",
    sizeLines: [],
    mainImage: p.url,
    tint: "slate",
  }));

  async function handlePptx() {
    setPptxError("");
    setPptxBusy(true);
    try {
      await generateCollectionPptx({
        collectionName: `${projectName} — Ảnh dự án`,
        customer,
        date: todayDDMMYYYY(),
        items,
        perSlide,
        infoVisibility: NO_INFO,
      });
    } catch {
      setPptxError("Xuất PPTX thất bại — thử lại hoặc bỏ bớt ảnh lỗi.");
    } finally {
      setPptxBusy(false);
    }
  }

  async function handlePdf() {
    setPdfError("");
    setPdfBusy(true);
    try {
      await generateCollectionPdf({
        collectionName: `${projectName} — Ảnh dự án`,
        customer,
        date: todayDDMMYYYY(),
        items,
        perSlide,
        infoVisibility: NO_INFO,
      });
    } catch {
      setPdfError("Xuất PDF thất bại — thử lại hoặc bỏ bớt ảnh lỗi.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md">
        <h3 className="text-[15px] font-bold">Xuất ảnh dự án ({photos.length})</h3>
        <p className="text-[12.5px] text-text-faint">
          File chỉ gồm ảnh, không kèm thông tin sản phẩm — dùng để gửi tham khảo, không phải Collection chính thức.
        </p>

        {(pptxError || pdfError) && (
          <div className="rounded-lg border border-red-soft bg-red-soft px-3.5 py-2.5 text-[12px] font-semibold text-red">
            {pptxError || pdfError}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Gửi (tuỳ chọn)</span>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="VD: JYSK"
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Số ảnh/trang</span>
          <select
            value={perSlide}
            onChange={(e) => setPerSlide(Number(e.target.value) as ProductsPerSlide)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
          >
            {PRODUCTS_PER_SLIDE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} ảnh/trang
              </option>
            ))}
          </select>
        </label>

        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handlePptx}
            disabled={pptxBusy || photos.length === 0}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg disabled:opacity-40"
          >
            {pptxBusy ? "Đang tạo…" : "Xuất PPTX"}
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={pdfBusy || photos.length === 0}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {pdfBusy ? "Đang tạo…" : "Xuất PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
