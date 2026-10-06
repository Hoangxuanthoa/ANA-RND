"use client";

import { useEffect, useRef, useState } from "react";
import { DrawingSheetContent, withPartName } from "./DrawingSheetA4";
import { buildDrawingBundle, productHasLid, SHEET_PART_LABEL, type DrawingBundle, type SheetPart } from "@/lib/breakdown/drawingBundle";
import { addDrawingSheetPage, createA4Pdf, sanitizeFileName, type PdfTitleField, type PdfViewSpec } from "@/lib/breakdown/pdfExport";
import { fetchDrawingTemplates, loadActiveTemplateId, type DrawingTemplate } from "@/lib/breakdown/drawingTemplate";
import type { ProductState } from "@/lib/breakdown/geometry/types";

interface Captured {
  views: PdfViewSpec[];
  fields: PdfTitleField[];
}

// One drawing sheet = one PDF page. A product with a lid contributes two
// (Thân, then Nắp), anything else one.
interface SheetItem {
  key: string;
  product: ProductState;
  part: SheetPart;
  bundle: DrawingBundle;
}

// Lets the user pick several products from this breakdown and export ALL of
// them into ONE combined PDF (one page per product) instead of the single-
// product "Xuất bản vẽ" flow. Reuses that exact same per-sheet rendering —
// DrawingSheetContent, unchanged — rather than re-deriving the drawing logic:
// each selected product gets its own hidden, off-screen instance (computed
// via buildDrawingBundle, since this runs outside the studio's own `active`-
// product hooks), which reports its rendered SVGs back via onCaptured the
// moment it mounts (its `doc` is built synchronously at mount from the
// product's saved drawing session, or defaults if none — so "mounted"
// already means "this product's sheet, fully drawn", no further settling).
// Once every selected product has reported in, their pages are assembled
// into one shared jsPDF document and saved as a single file.
export function MultiDrawingExport({
  products,
  breakdownName,
  onClose,
}: {
  products: ProductState[];
  breakdownName: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(products.map((p) => p.id)));
  const [template, setTemplate] = useState<DrawingTemplate | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only set while actively capturing — the products (+ their precomputed
  // geometry bundle) currently mounted off-screen for this export run.
  const [captureQueue, setCaptureQueue] = useState<SheetItem[] | null>(null);
  const capturedRef = useRef<Map<string, Captured>>(new Map());
  const resolveWaitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDrawingTemplates(), loadActiveTemplateId()]).then(([list, savedActiveId]) => {
      if (cancelled) return;
      setTemplate(list.find((t) => t.id === savedActiveId) ?? list[0]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  }

  function handleOneCaptured(key: string, capture: Captured) {
    capturedRef.current.set(key, capture);
    if (captureQueue && capturedRef.current.size >= captureQueue.length) {
      resolveWaitRef.current?.();
    }
  }

  async function handleExport() {
    if (!template) return;
    setError(null);
    const chosen = products.filter((p) => selected.has(p.id));
    const withBundles: SheetItem[] = [];
    const skipped: string[] = [];
    for (const product of chosen) {
      const bundle = buildDrawingBundle(product, "body");
      if (!bundle) {
        skipped.push(product.name || product.id);
        continue;
      }
      withBundles.push({ key: `${product.id}:body`, product, part: "body", bundle });
      if (productHasLid(product)) {
        const lidBundle = buildDrawingBundle(product, "lid");
        if (lidBundle) withBundles.push({ key: `${product.id}:lid`, product, part: "lid", bundle: lidBundle });
        else skipped.push(`${product.name || product.id} (Nắp)`);
      }
    }
    if (withBundles.length === 0) {
      setError("Không có sản phẩm nào hợp lệ để xuất.");
      return;
    }

    setExporting(true);
    capturedRef.current = new Map();
    setCaptureQueue(withBundles);
    try {
      // Hidden instances report in via handleOneCaptured as they mount; a
      // generous timeout guards against one that never does (a render
      // crash somewhere) leaving this hung forever instead of failing loud.
      await Promise.race([
        new Promise<void>((resolve) => {
          resolveWaitRef.current = resolve;
        }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);

      const pdf = await createA4Pdf();
      let first = true;
      for (const { key, product } of withBundles) {
        const capture = capturedRef.current.get(key);
        if (!capture) continue;
        if (!first) pdf.addPage();
        first = false;
        await addDrawingSheetPage(pdf, {
          productName: product.name || product.id,
          companyName: template.companyName,
          logoDataUrl: template.logoDataUrl,
          titleBlockWidthMm: template.titleBlockWidthMm,
          fieldRowMinHeightMm: template.fieldRowMinHeightMm,
          fields: capture.fields,
          views: capture.views,
          showViewFrame: template.showViewFrame,
        });
      }
      pdf.save(`${sanitizeFileName(breakdownName)}-gop-ban-ve.pdf`);
      if (skipped.length > 0) setError(`Đã bỏ qua (chưa dựng được hình): ${skipped.join(", ")}`);
      else onClose();
    } catch {
      setError("Xuất PDF gộp thất bại — thử lại.");
    } finally {
      setExporting(false);
      setCaptureQueue(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-[480px] max-w-[95vw] flex-col rounded-xl bg-surface p-5 shadow-xl">
        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
          <span className="text-[15px] font-bold text-text">Xuất gộp nhiều sản phẩm</span>
          <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1 text-[13px] font-semibold text-text-muted hover:bg-bg hover:text-text">
            Đóng
          </button>
        </div>

        <div className="mb-2 flex flex-shrink-0 items-center justify-between">
          <span className="text-[12px] text-text-faint">Chọn sản phẩm để gộp vào 1 file PDF (mỗi sản phẩm 1 trang; sản phẩm có nắp 2 trang: Thân + Nắp)</span>
          <button type="button" onClick={toggleAll} className="text-[12px] font-semibold text-accent hover:underline">
            {selected.size === products.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-lg border border-line bg-white p-2">
          {products.map((p, i) => (
            <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold text-text hover:bg-bg">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
              <span className="truncate">{p.name || `Sản phẩm ${i + 1}`}</span>
              {p.code && <span className="flex-shrink-0 text-[11px] font-normal text-text-faint">{p.code}</span>}
            </label>
          ))}
        </div>

        {error && <p className="mt-2 flex-shrink-0 text-[12px] text-red">{error}</p>}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !template || selected.size === 0}
          className="mt-3 h-10 flex-shrink-0 rounded-lg bg-accent text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {exporting ? `Đang xuất… (${capturedRef.current.size}/${captureQueue?.length ?? 0})` : `Xuất PDF gộp (${selected.size} sản phẩm)`}
        </button>
      </div>

      {/* Off-screen render-only instances — never shown, just mounted long
          enough to draw their own SVGs and report back via onCaptured. */}
      {captureQueue && template && (
        <div style={{ position: "fixed", left: -99999, top: 0, width: 1200 }} aria-hidden>
          {captureQueue.map(({ key, product, part, bundle }) => (
            <div key={key} style={{ width: 1200, height: 800 }}>
              <DrawingSheetContent
                drawing={bundle.drawing}
                productName={productHasLid(product) ? `${product.name || product.id} — ${SHEET_PART_LABEL[part]}` : product.name || product.id}
                frameResult={bundle.frameResult}
                handle={product.handle}
                handleArcView={bundle.handleArcView}
                handlePaths={bundle.handlePaths}
                material={bundle.material}
                template={template}
                onOpenManager={() => {}}
                templateOptions={[{ id: template.id, name: template.name }]}
                activeTemplateId={template.id}
                onSelectTemplate={() => {}}
                onClose={() => {}}
                initialDoc={
                  productHasLid(product)
                    ? withPartName(part === "lid" ? product.drawingDocLid : product.drawingDoc, product.name || product.id, `${product.name || product.id} — ${SHEET_PART_LABEL[part]}`)
                    : product.drawingDoc
                }
                onCaptured={(capture) => handleOneCaptured(key, capture)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
