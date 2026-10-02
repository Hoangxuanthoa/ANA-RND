// Exports the Calculate (BOM) sheet to PDF and XLSX. Plain jsPDF tables (no
// SVG/svg2pdf involved, unlike pdfExport.ts's drawing sheet) since a BOM is
// just rows of text/numbers — portrait A4, matching ANASU's own BOM PDF.
//
// XLSX via the `xlsx` (SheetJS CE) package — pinned at 0.18.5, the last
// version SheetJS publishes to npm; `npm audit` flags it for a prototype-
// pollution and a ReDoS advisory, but both live in its PARSING path
// (XLSX.read/readFile) and this file only ever calls the WRITE path
// (XLSX.utils.aoa_to_sheet/book_new, XLSX.writeFile) on data we generated
// ourselves, never on an uploaded/untrusted file — never add a read/parse
// call here without re-checking that advisory.
import { ensureManropeFont, sanitizeFileName } from "./pdfExport";
import type { BomAreaRow, BomSteelRow } from "./geometry/bomEngine";

const MARGIN = 14;

function vnd(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

export interface BomExportData {
  productName: string;
  productCode: string;
  steelRows: BomSteelRow[];
  steelPricePerKg: number;
  areaRows: BomAreaRow[];
  // Keyed by BomAreaRow.id — one shared price (same value under every row's
  // id) or a genuinely different price per khoang, since each material band
  // can be a different fabric/weave at a different cost. The sheet decides
  // which; this file just reads whatever price each row's id maps to.
  areaPrices: Record<string, number>;
}

const STEEL_COLS = [
  { key: "label" as const, label: "Chi tiết", w: 34, align: "left" as const },
  { key: "group" as const, label: "Bộ phận", w: 18, align: "left" as const },
  { key: "lengthPerPieceM" as const, label: "Dài/cái (m)", w: 20, align: "right" as const },
  { key: "quantity" as const, label: "SL", w: 12, align: "right" as const },
  { key: "fiMm" as const, label: "FI", w: 12, align: "right" as const },
  { key: "totalLengthM" as const, label: "Tổng dài (m)", w: 22, align: "right" as const },
  { key: "weightKg" as const, label: "Cân nặng (kg)", w: 22, align: "right" as const },
  { key: "unitPrice" as const, label: "Đơn giá", w: 22, align: "right" as const },
  { key: "cost" as const, label: "Thành tiền", w: 24, align: "right" as const },
];

const AREA_COLS = [
  { key: "label" as const, label: "Chi tiết", w: 40, align: "left" as const },
  { key: "group" as const, label: "Bộ phận", w: 28, align: "left" as const },
  { key: "areaM2" as const, label: "Diện tích (m²)", w: 28, align: "right" as const },
  { key: "unitPrice" as const, label: "Đơn giá", w: 28, align: "right" as const },
  { key: "cost" as const, label: "Thành tiền", w: 30, align: "right" as const },
];

export async function exportBomPdf(data: BomExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await ensureManropeFont(pdf);
  pdf.setFont("Manrope", "normal");

  let y = MARGIN;
  pdf.setFontSize(15);
  pdf.setFont("Manrope", "bold");
  pdf.text("BẢNG TÍNH VẬT TƯ (BOM)", MARGIN, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont("Manrope", "normal");
  pdf.text(`Sản phẩm: ${data.productName}${data.productCode ? `  —  Mã: ${data.productCode}` : ""}`, MARGIN, y);
  y += 9;

  function tableHeader(cols: { label: string; w: number; align: "left" | "right" }[], rowH: number) {
    pdf.setFont("Manrope", "bold");
    pdf.setFontSize(8.5);
    pdf.setFillColor(238, 238, 238);
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    pdf.rect(MARGIN, y, totalW, rowH, "F");
    let x = MARGIN;
    for (const c of cols) {
      pdf.text(c.label, c.align === "left" ? x + 1.5 : x + c.w - 1.5, y + rowH - 2, { align: c.align });
      x += c.w;
    }
    y += rowH;
  }

  function tableRow(cols: { key: string; w: number; align: "left" | "right" }[], values: Record<string, string>, rowH: number, bold = false) {
    pdf.setFont("Manrope", bold ? "bold" : "normal");
    pdf.setFontSize(8.5);
    let x = MARGIN;
    for (const c of cols) {
      pdf.text(values[c.key] ?? "", c.align === "left" ? x + 1.5 : x + c.w - 1.5, y + rowH - 2, { align: c.align });
      x += c.w;
    }
    const totalW = cols.reduce((s, cc) => s + cc.w, 0);
    pdf.setDrawColor(210);
    pdf.line(MARGIN, y + rowH, MARGIN + totalW, y + rowH);
    y += rowH;
  }

  const rowH = 6;

  pdf.setFont("Manrope", "bold");
  pdf.setFontSize(11);
  pdf.text("KHUNG SẮT", MARGIN, y);
  y += 5;
  tableHeader(STEEL_COLS, rowH);
  let steelTotalLength = 0;
  let steelTotalWeight = 0;
  let steelTotalCost = 0;
  for (const r of data.steelRows) {
    const cost = r.weightKg * data.steelPricePerKg;
    steelTotalLength += r.totalLengthM;
    steelTotalWeight += r.weightKg;
    steelTotalCost += cost;
    tableRow(STEEL_COLS, {
      label: r.label,
      group: r.group,
      lengthPerPieceM: r.lengthPerPieceM.toFixed(2),
      quantity: String(r.quantity),
      fiMm: String(r.fiMm),
      totalLengthM: r.totalLengthM.toFixed(2),
      weightKg: r.weightKg.toFixed(3),
      unitPrice: vnd(data.steelPricePerKg),
      cost: vnd(cost),
    }, rowH);
  }
  tableRow(
    STEEL_COLS,
    { label: "TỔNG", totalLengthM: steelTotalLength.toFixed(2), weightKg: steelTotalWeight.toFixed(3), cost: vnd(steelTotalCost) },
    rowH,
    true,
  );

  y += 8;
  pdf.setFont("Manrope", "bold");
  pdf.setFontSize(11);
  pdf.text("DIỆN TÍCH ĐAN", MARGIN, y);
  y += 5;
  tableHeader(AREA_COLS, rowH);
  let areaTotal = 0;
  let areaTotalCost = 0;
  for (const r of data.areaRows) {
    const price = data.areaPrices[r.id] ?? 0;
    const cost = r.areaM2 * price;
    areaTotal += r.areaM2;
    areaTotalCost += cost;
    tableRow(AREA_COLS, { label: r.label, group: r.group, areaM2: r.areaM2.toFixed(2), unitPrice: vnd(price), cost: vnd(cost) }, rowH);
  }
  tableRow(AREA_COLS, { label: "TỔNG", areaM2: areaTotal.toFixed(2), cost: vnd(areaTotalCost) }, rowH, true);

  pdf.save(`BOM_${sanitizeFileName(data.productName)}.pdf`);
}

export async function exportBomExcel(data: BomExportData): Promise<void> {
  const XLSX = await import("xlsx");

  const steelAoa: (string | number)[][] = [
    ["BẢNG TÍNH VẬT TƯ (BOM)"],
    [`Sản phẩm: ${data.productName}`, `Mã: ${data.productCode}`],
    [],
    ["KHUNG SẮT"],
    ["Chi tiết", "Bộ phận", "Dài/cái (m)", "Số lượng", "FI (mm)", "Tổng dài (m)", "Cân nặng (kg)", "Đơn giá (đ/kg)", "Thành tiền (đ)"],
  ];
  let steelTotalLength = 0;
  let steelTotalWeight = 0;
  let steelTotalCost = 0;
  for (const r of data.steelRows) {
    const cost = r.weightKg * data.steelPricePerKg;
    steelTotalLength += r.totalLengthM;
    steelTotalWeight += r.weightKg;
    steelTotalCost += cost;
    steelAoa.push([r.label, r.group, r.lengthPerPieceM, r.quantity, r.fiMm, r.totalLengthM, r.weightKg, data.steelPricePerKg, Math.round(cost)]);
  }
  steelAoa.push(["TỔNG", "", "", "", "", steelTotalLength, Math.round(steelTotalWeight * 1000) / 1000, "", Math.round(steelTotalCost)]);

  steelAoa.push([]);
  steelAoa.push(["DIỆN TÍCH ĐAN"]);
  steelAoa.push(["Chi tiết", "Bộ phận", "Diện tích (m²)", "Đơn giá (đ/m²)", "Thành tiền (đ)"]);
  let areaTotal = 0;
  let areaTotalCost = 0;
  for (const r of data.areaRows) {
    const price = data.areaPrices[r.id] ?? 0;
    const cost = r.areaM2 * price;
    areaTotal += r.areaM2;
    areaTotalCost += cost;
    steelAoa.push([r.label, r.group, Math.round(r.areaM2 * 10000) / 10000, price, Math.round(cost)]);
  }
  steelAoa.push(["TỔNG", "", Math.round(areaTotal * 10000) / 10000, "", Math.round(areaTotalCost)]);

  const sheet = XLSX.utils.aoa_to_sheet(steelAoa);
  sheet["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "BOM");
  XLSX.writeFile(wb, `BOM_${sanitizeFileName(data.productName)}.xlsx`);
}
