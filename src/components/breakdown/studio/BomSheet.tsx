"use client";

import { useState } from "react";
import type { BomAreaRow, BomSteelRow } from "@/lib/breakdown/geometry/bomEngine";
import { exportBomExcel, exportBomPdf } from "@/lib/breakdown/bomExport";

interface BomSheetProps {
  productName: string;
  productCode: string;
  // Pre-computed by the caller (page.tsx) — which shape-specific
  // buildXSteelFrame/buildXAreaBom pair to use is a per-shape concern this
  // component shouldn't need to know about; it only renders+prices+exports
  // whatever rows it's handed.
  steelRows: BomSteelRow[];
  areaRows: BomAreaRow[];
}

function vnd(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("vi-VN");
}

export function BomSheet({ productName, productCode, steelRows, areaRows }: BomSheetProps) {
  // Tạm thời nhập tay — sẽ chuyển sang bảng "dữ liệu đầu vào" dùng chung sau.
  const [steelPricePerKg, setSteelPricePerKg] = useState(0);
  // Mỗi khoang đan có thể là 1 loại nguyên liệu khác nhau (giá khác nhau) —
  // "uniform" = 1 ô giá chung áp cho mọi khoang (mặc định, đơn giản hơn);
  // "perRow" = mỗi dòng tự nhập giá riêng.
  const [areaPriceMode, setAreaPriceMode] = useState<"uniform" | "perRow">("uniform");
  const [uniformAreaPrice, setUniformAreaPrice] = useState(0);
  const [perRowAreaPrices, setPerRowAreaPrices] = useState<Record<string, number>>({});
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  function areaPriceFor(rowId: string): number {
    return areaPriceMode === "uniform" ? uniformAreaPrice : (perRowAreaPrices[rowId] ?? 0);
  }
  function setAreaPriceFor(rowId: string, value: number) {
    setPerRowAreaPrices((prev) => ({ ...prev, [rowId]: value }));
  }

  const steelTotalLengthM = steelRows.reduce((s, r) => s + r.totalLengthM, 0);
  const steelTotalWeightKg = steelRows.reduce((s, r) => s + r.weightKg, 0);
  const steelTotalCost = steelTotalWeightKg * steelPricePerKg;
  const areaTotalM2 = areaRows.reduce((s, r) => s + r.areaM2, 0);
  const areaTotalCost = areaRows.reduce((s, r) => s + r.areaM2 * areaPriceFor(r.id), 0);

  function exportPayload() {
    const areaPrices: Record<string, number> = {};
    for (const r of areaRows) areaPrices[r.id] = areaPriceFor(r.id);
    return { productName, productCode, steelRows, steelPricePerKg, areaRows, areaPrices };
  }

  async function handleExportPdf() {
    setExporting("pdf");
    try {
      await exportBomPdf(exportPayload());
    } finally {
      setExporting(null);
    }
  }

  async function handleExportExcel() {
    setExporting("xlsx");
    try {
      await exportBomExcel(exportPayload());
    } finally {
      setExporting(null);
    }
  }

  const th = "px-2 py-1.5 text-left text-[11px] font-bold tracking-wide text-text-muted uppercase";
  const thR = "px-2 py-1.5 text-right text-[11px] font-bold tracking-wide text-text-muted uppercase";
  const td = "px-2 py-1 text-[12.5px] text-text";
  const tdR = "px-2 py-1 text-right text-[12.5px] text-text tabular-nums";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-baseline gap-3 border-b border-line pb-2">
        <span className="text-[14px] font-bold text-text">{productName}</span>
        {productCode && <span className="text-[12px] text-text-faint">Mã: {productCode}</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        {/* KHUNG SẮT */}
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-text">KHUNG SẮT</span>
            <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-muted">
              Đơn giá (đ/kg)
              <input
                type="number"
                min={0}
                value={steelPricePerKg}
                onChange={(e) => setSteelPricePerKg(Math.max(0, Number(e.target.value) || 0))}
                className="h-7 w-24 rounded border border-line px-1.5 text-[12px]"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Chi tiết</th>
                  <th className={th}>Bộ phận</th>
                  <th className={thR}>Dài/cái (m)</th>
                  <th className={thR}>SL</th>
                  <th className={thR}>FI</th>
                  <th className={thR}>Tổng dài (m)</th>
                  <th className={thR}>Cân nặng (kg)</th>
                  <th className={thR}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {steelRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-[12px] text-text-faint">
                      Chưa có thanh sắt nào (kiểm tra lại cấu hình Khung sắt).
                    </td>
                  </tr>
                )}
                {steelRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className={td}>{r.label}</td>
                    <td className={td}>{r.group}</td>
                    <td className={tdR}>{r.lengthPerPieceM.toFixed(2)}</td>
                    <td className={tdR}>{r.quantity}</td>
                    <td className={tdR}>{r.fiMm}</td>
                    <td className={tdR}>{r.totalLengthM.toFixed(2)}</td>
                    <td className={tdR}>{r.weightKg.toFixed(3)}</td>
                    <td className={tdR}>{vnd(r.weightKg * steelPricePerKg)}</td>
                  </tr>
                ))}
              </tbody>
              {steelRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-line font-bold">
                    <td className={td} colSpan={5}>
                      TỔNG
                    </td>
                    <td className={tdR}>{steelTotalLengthM.toFixed(2)}</td>
                    <td className={tdR}>{steelTotalWeightKg.toFixed(3)}</td>
                    <td className={tdR}>{vnd(steelTotalCost)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* DIỆN TÍCH ĐAN */}
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold text-text">DIỆN TÍCH ĐAN</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-line bg-bg p-0.5">
                <button
                  type="button"
                  onClick={() => setAreaPriceMode("uniform")}
                  className={
                    areaPriceMode === "uniform"
                      ? "rounded bg-accent px-2 py-1 text-[11px] font-bold text-white"
                      : "rounded px-2 py-1 text-[11px] font-semibold text-text-muted"
                  }
                >
                  1 giá chung
                </button>
                <button
                  type="button"
                  onClick={() => setAreaPriceMode("perRow")}
                  className={
                    areaPriceMode === "perRow"
                      ? "rounded bg-accent px-2 py-1 text-[11px] font-bold text-white"
                      : "rounded px-2 py-1 text-[11px] font-semibold text-text-muted"
                  }
                >
                  Giá riêng từng khoang
                </button>
              </div>
              {areaPriceMode === "uniform" && (
                <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-muted">
                  Đơn giá (đ/m²)
                  <input
                    type="number"
                    min={0}
                    value={uniformAreaPrice}
                    onChange={(e) => setUniformAreaPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 w-24 rounded border border-line px-1.5 text-[12px]"
                  />
                </label>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Chi tiết</th>
                  <th className={th}>Bộ phận</th>
                  <th className={thR}>Diện tích (m²)</th>
                  <th className={thR}>Đơn giá (đ/m²)</th>
                  <th className={thR}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {areaRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className={td}>{r.label}</td>
                    <td className={td}>{r.group}</td>
                    <td className={tdR}>{r.areaM2.toFixed(2)}</td>
                    <td className={tdR}>
                      {areaPriceMode === "perRow" ? (
                        <input
                          type="number"
                          min={0}
                          value={perRowAreaPrices[r.id] ?? 0}
                          onChange={(e) => setAreaPriceFor(r.id, Math.max(0, Number(e.target.value) || 0))}
                          className="h-6 w-20 rounded border border-line px-1 text-right text-[12px]"
                        />
                      ) : (
                        vnd(uniformAreaPrice)
                      )}
                    </td>
                    <td className={tdR}>{vnd(r.areaM2 * areaPriceFor(r.id))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-bold">
                  <td className={td} colSpan={2}>
                    TỔNG
                  </td>
                  <td className={tdR}>{areaTotalM2.toFixed(2)}</td>
                  <td className={tdR}></td>
                  <td className={tdR}>{vnd(areaTotalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-line bg-bg px-3.5 py-2.5">
        <span className="text-[12.5px] font-bold text-text">TỔNG CHI PHÍ DỰ KIẾN</span>
        <span className="text-[15px] font-bold text-accent">{vnd(steelTotalCost + areaTotalCost)} đ</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting !== null}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-white text-[12.5px] font-semibold text-text-muted hover:text-text disabled:opacity-50"
        >
          {exporting === "pdf" ? "Đang xuất…" : "⬇ Xuất PDF"}
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting !== null}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {exporting === "xlsx" ? "Đang xuất…" : "⬇ Xuất Excel"}
        </button>
      </div>
      <p className="text-[11px] text-text-faint">
        Giá sắt/m² vật liệu nhập tay tạm thời — sẽ chuyển sang bảng dữ liệu đầu vào dùng chung sau. Diện tích đan cho Square/Rectangle/Oval/Ellipse là công thức tự suy ra (không có công thức gốc để đối chiếu như Round) — nên kiểm tra lại số liệu trước khi dùng chính thức.
      </p>
    </div>
  );
}
