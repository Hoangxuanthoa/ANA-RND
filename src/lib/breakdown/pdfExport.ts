// Exports the on-screen A4 drawing sheet to a real PDF file, matching what's
// visible exactly: current mode/views, every dimension's hide/offset/
// override state, notes, text color — since all of that already lives in
// the live SVG DOM, we hand that same DOM to svg2pdf.js rather than
// re-implementing the drawing logic a second time in jsPDF's own API.
import { computeGridLayout } from "./drawingTemplate";

export interface PdfTitleField {
  label: string;
  value: string;
}

export interface PdfViewSpec {
  key: string;
  label: string;
  visible: boolean;
  svgEl: SVGSVGElement | null;
}

const PAGE_W = 297;
const PAGE_H = 210;
// Standard drafting-frame margin (ISO 5457) — matches DrawingSheetA4.tsx's
// own PAGE_MARGIN_MM so the exported PDF and the on-screen preview agree on
// where the frame sits relative to the physical paper edge.
const MARGIN = 10;
const GAP = 3;
const CELL_HEADER_H = 5;
// Blank border between a view's own drawing and the cell's outer rule —
// kept generous (not just enough to avoid touching) so a product silhouette
// never reads as "cut off" at a tight "1:x" scale or a naturally large auto
// fit; also shrinks PDF_CELL_CONTENT_HEIGHT_MM below, which is what a
// chosen "1:x" scale is computed against, so the stated ratio stays exact
// for whatever content area this leaves rather than an approximation.
const CELL_PAD = 4;
const LOGO_H = 14;
// Two-tier line weight (ISO 128 / TCVN 8-20 drafting convention — a thick
// outline for the drawing's own main frames, a thin one for internal grid
// lines/dividers, roughly a 2:1 ratio) so the sheet reads as views + a
// title block rather than a uniform spreadsheet of same-weight boxes. Only
// the title block's own outer rectangle uses THICK_LINE_MM; every view
// cell and every internal divider (row-to-row, label-to-value) stays thin.
const THIN_LINE_MM = 0.2;
const THICK_LINE_MM = 0.5;
// A field row always splits into this label:value ratio — the MINIMUM
// total row height itself is user-adjustable (DrawingTemplate's
// fieldRowMinHeightMm, edited in TemplateManager.tsx), but however tall a
// row ends up (that minimum, or more when stretched to fill spare vertical
// room — see rowH below), the gray label strip and the white value strip
// both grow together in this same proportion. Exported so DrawingSheetA4.tsx
// can split its own on-screen row the identical way, keeping the preview
// and the print visually in sync.
export const ROW_LABEL_WEIGHT = 4.6;
export const ROW_VALUE_WEIGHT = 6.2;

// The real printed height (mm) available for a view's own drawing inside
// its cell, after the header strip and padding — exported so a "1:x" scale
// picker (DrawingSheetA4.tsx) can work out exactly what SVG-viewBox half-
// extent makes 1mm of product become 1/x mm on the actual A4 page, instead
// of guessing a screen-only ratio that wouldn't match what's printed. This
// dimension (not cell width) is what actually limits the fit, since every
// view's viewBox here is square while the cell itself is wider than tall.
// A function of the grid's row count (not a fixed constant) now that the
// number of views — and therefore the grid shape — is template-driven
// rather than always exactly 2×2; every view in the SAME sheet still
// shares one row height (a uniform grid), so callers compute this once per
// sheet render from computeGridLayout(views.length).rows.
export function computeCellContentHeightMm(rows: number, showViewFrame: boolean = true): number {
  const drawAreaH = PAGE_H - MARGIN * 2;
  const cellH = (drawAreaH - GAP * (rows - 1)) / rows;
  return cellH - (showViewFrame ? CELL_HEADER_H : 0) - CELL_PAD * 2;
}

// svg2pdf can't render <foreignObject> (our notes and the transient dim-edit
// input both use it, for easy on-screen editing) — replace each with a
// plain <text> carrying the same content before handing the SVG off, on a
// detached clone so the live, interactive page is never touched.
function prepareSvgClone(svgEl: SVGSVGElement): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("foreignObject").forEach((fo) => {
    const field = fo.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    const value = field ? field.value : (fo.textContent ?? "").trim();
    const x = Number(fo.getAttribute("x")) || 0;
    const y = Number(fo.getAttribute("y")) || 0;
    const h = Number(fo.getAttribute("height")) || 12;
    if (!value) {
      fo.remove();
      return;
    }
    // The note/text box's own size and color live in the field's inline
    // style (see NoteItem/TextBoxItem in TechnicalDrawing.tsx) in the SAME
    // svg user-space units as everything else, so reading them back here is
    // what keeps a resized/recolored note looking identical in the PDF —
    // a fixed size here is what used to print every note tiny regardless of
    // the on-screen font size.
    const parsedSize = field ? parseFloat(field.style.fontSize) : NaN;
    const fontSize = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 10.5;
    const fill = (field && field.style.color) || "#1a1a1a";
    const isTextarea = field instanceof HTMLTextAreaElement;
    const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textEl.setAttribute("font-size", String(fontSize));
    textEl.setAttribute("font-family", "Manrope, sans-serif");
    textEl.setAttribute("fill", fill);
    const lines = value.split("\n");
    if (isTextarea) {
      // Top-anchored, multi-line: the textarea sits at its own `top` inside
      // the foreignObject (offset down by the drag handle while selected).
      const top = y + (parseFloat(field.style.top) || 0);
      textEl.setAttribute("x", String(x + 1));
      lines.forEach((line, i) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", String(x + 1));
        tspan.setAttribute("y", String(top + 1 + fontSize * (1 + 1.2 * i)));
        tspan.textContent = line;
        textEl.appendChild(tspan);
      });
    } else {
      // A note's input is vertically centered in its box.
      textEl.setAttribute("x", String(x + 4));
      textEl.setAttribute("y", String(y + h / 2 + fontSize * 0.35));
      textEl.textContent = value;
    }
    fo.replaceWith(textEl);
  });
  return clone;
}

// jsPDF renders a transparent PNG's see-through pixels as black rather than
// leaving them see-through (a long-standing jsPDF limitation, not something
// fixable via the `format` argument) — so a logo that looks clean on a white
// background on screen comes out with a black background in the exported
// PDF. Composited onto an opaque white canvas first, the logo always prints
// exactly like it previews: white behind it, since the on-screen sheet
// itself sits on a white background (see the sheet's own `bg-white`).
function flattenLogoOnWhite(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// jsPDF's built-in fonts (Helvetica etc.) only cover WinAnsi/Latin-1 — every
// Vietnamese diacritic (and the Ø/symbol glyphs some dim labels use) comes
// out as garbage without a real embedded font. Manrope already ships with
// full Vietnamese coverage and is the app's own font, so both the PDF-native
// text (title block) and the SVG text (svg2pdf resolves font-family against
// whatever's registered here, hence "Manrope" being set as the SVG font too
// in TechnicalDrawing.tsx) end up visually consistent.
type PdfWithVfs = InstanceType<typeof import("jspdf").jsPDF>;
let manropeBase64: Promise<string> | null = null;
export async function ensureManropeFont(pdf: PdfWithVfs): Promise<void> {
  if (!manropeBase64) {
    manropeBase64 = fetch("/fonts/Manrope.ttf")
      .then((res) => res.arrayBuffer())
      .then(arrayBufferToBase64);
  }
  const base64 = await manropeBase64;
  pdf.addFileToVFS("Manrope.ttf", base64);
  pdf.addFont("Manrope.ttf", "Manrope", "normal");
  pdf.addFont("Manrope.ttf", "Manrope", "bold");
}

export function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "_") || "san-pham"
  );
}

// Minimal structural type for the jsPDF instance both createA4Pdf and
// addDrawingSheetPage pass around — avoids a static top-level `import
// type {jsPDF} from "jspdf"` pulling the real module in at module-eval time
// for every caller of this file, matching the existing dynamic-import
// convention (jsPDF/svg2pdf are only ever loaded inside these async
// functions, right before they're actually needed).
type PdfDoc = InstanceType<typeof import("jspdf").jsPDF>;

// Creates and configures one shared A4 landscape document — callers that
// export MULTIPLE products into one combined file create this ONCE, then
// call addDrawingSheetPage once per product (with pdf.addPage() between
// them), instead of each product getting its own separate PDF.
export async function createA4Pdf(): Promise<PdfDoc> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await ensureManropeFont(pdf);
  pdf.setFont("Manrope", "normal");
  pdf.setLineWidth(THIN_LINE_MM);
  pdf.setDrawColor(0); // view-cell borders/dividers black, matching the on-screen panel
  return pdf;
}

// Draws one product's A4 sheet (views grid + title block) onto `pdf`'s
// CURRENT page — the caller is responsible for calling pdf.addPage() first
// when this isn't the first sheet in the document. Split out of
// exportDrawingSheetPdf (below, which still creates its own single-page
// document and saves it — unchanged for every existing single-product
// caller) so a multi-product export can reuse the exact same per-sheet
// drawing logic without re-deriving it.
export async function addDrawingSheetPage(
  pdf: PdfDoc,
  {
    companyName,
    logoDataUrl,
    titleBlockWidthMm,
    fieldRowMinHeightMm,
    fields,
    views,
    showViewFrame,
  }: {
    // Not read here — the title block's own "Tên bản vẽ" field (inside
    // `fields`) already carries the product name onto the page; this is
    // only still accepted (and ignored) so callers can pass the exact same
    // params object exportDrawingSheetPdf's own signature takes, filename
    // included, without having to shape two slightly different param types.
    productName?: string;
    companyName: string;
    logoDataUrl: string | null;
    titleBlockWidthMm: number;
    fieldRowMinHeightMm: number;
    fields: PdfTitleField[];
    views: PdfViewSpec[];
    showViewFrame: boolean;
  },
): Promise<void> {
  const { svg2pdf } = await import("svg2pdf.js");

  const flatLogo = logoDataUrl ? await flattenLogoOnWhite(logoDataUrl) : null;
  pdf.setFont("Manrope", "normal");
  pdf.setLineWidth(THIN_LINE_MM);
  pdf.setDrawColor(0);

  const drawAreaX = MARGIN;
  const drawAreaY = MARGIN;
  const drawAreaW = PAGE_W - MARGIN * 2 - titleBlockWidthMm - GAP;
  const drawAreaH = PAGE_H - MARGIN * 2;
  const { cols, rows } = computeGridLayout(views.length);
  const cellW = (drawAreaW - GAP * (cols - 1)) / cols;
  const cellH = (drawAreaH - GAP * (rows - 1)) / rows;

  const headerH = showViewFrame ? CELL_HEADER_H : 0;
  for (let i = 0; i < views.length; i++) {
    const view = views[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const pos = { x: drawAreaX + col * (cellW + GAP), y: drawAreaY + row * (cellH + GAP) };
    if (showViewFrame) {
      pdf.rect(pos.x, pos.y, cellW, cellH);
      pdf.setFontSize(7.5);
      pdf.setTextColor(0);
      pdf.text(view.label.toUpperCase(), pos.x + 1.5, pos.y + CELL_HEADER_H - 1);
      pdf.line(pos.x, pos.y + CELL_HEADER_H, pos.x + cellW, pos.y + CELL_HEADER_H);
    }

    if (view.visible && view.svgEl) {
      const clone = prepareSvgClone(view.svgEl);
      await svg2pdf(clone, pdf, {
        x: pos.x + CELL_PAD,
        y: pos.y + headerH + CELL_PAD,
        width: cellW - CELL_PAD * 2,
        height: cellH - headerH - CELL_PAD * 2,
      });
    } else if (!view.visible) {
      pdf.setFontSize(9);
      pdf.setTextColor(170);
      pdf.text("Đã ẩn", pos.x + cellW / 2, pos.y + headerH + (cellH - headerH) / 2, { align: "center" });
    }
  }

  // Title block — branding now comes from whichever template the sheet is
  // using (DrawingSheetA4.tsx), not a hardcoded company.
  const tbX = drawAreaX + drawAreaW + GAP;
  const tbY = MARGIN;
  pdf.setDrawColor(0); // title block borders/dividers are all black, matching the on-screen panel

  // Row geometry first — the gray label fills below must ALL be painted
  // before any border line, otherwise each fill covers the inner half of
  // the thick outer frame (and the divider lines) it overlaps, which is
  // what made the frame look broken/uneven in the exported PDF.
  const titleAreaH = drawAreaH - LOGO_H;
  const rowH = fields.length > 0 ? Math.max(fieldRowMinHeightMm, titleAreaH / fields.length) : fieldRowMinHeightMm;
  const rowLabelH = rowH * (ROW_LABEL_WEIGHT / (ROW_LABEL_WEIGHT + ROW_VALUE_WEIGHT));
  const rowValueH = rowH - rowLabelH;

  pdf.setFillColor(245, 245, 244); // matches --bg
  let fillY = tbY + LOGO_H;
  for (let i = 0; i < fields.length; i++) {
    pdf.rect(tbX, fillY, titleBlockWidthMm, rowLabelH, "F");
    fillY += rowH;
  }

  if (flatLogo) {
    // Fit within the logo strip, preserving aspect ratio, centered.
    try {
      const props = pdf.getImageProperties(flatLogo);
      const maxW = titleBlockWidthMm - 6;
      const maxH = LOGO_H - 3;
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      pdf.addImage(flatLogo, "PNG", tbX + (titleBlockWidthMm - w) / 2, tbY + (LOGO_H - h) / 2, w, h);
    } catch {
      // Corrupt/unsupported image data — fall back to text so export still succeeds.
      pdf.setFontSize(13);
      pdf.setTextColor(0);
      pdf.setFont("Manrope", "bold");
      pdf.text(companyName || "—", tbX + titleBlockWidthMm / 2, tbY + LOGO_H / 2 + 2, { align: "center" });
    }
  } else {
    pdf.setFontSize(13);
    pdf.setTextColor(0);
    pdf.setFont("Manrope", "bold");
    pdf.text(companyName || "—", tbX + titleBlockWidthMm / 2, tbY + LOGO_H / 2 + 2, { align: "center" });
  }
  // Row heights grow to fill whatever vertical room the field list leaves —
  // a template with few fields fills the whole title-block height instead
  // of crowding at the top with the page left blank below (never shrinks
  // past fieldRowMinHeightMm when there are many fields, in which case rows
  // sit at that user-set minimum same as before this).
  let rowY = tbY + LOGO_H;
  const dividerYs: number[] = [tbY + LOGO_H];
  for (const field of fields) {
    pdf.setFontSize(6.5);
    pdf.setFont("Manrope", "bold");
    pdf.setTextColor(0);
    // Vertically centered in the label strip (baseline sits ~1.1mm below
    // true center for this font size), left-aligned.
    pdf.text(field.label.toUpperCase(), tbX + 2, rowY + rowLabelH / 2 + 1.1);
    rowY += rowLabelH;
    dividerYs.push(rowY); // between the label strip and the value strip

    pdf.setFontSize(9);
    pdf.setFont("Manrope", "normal");
    pdf.setTextColor(0);
    pdf.text(field.value || "—", tbX + 2, rowY + Math.min(rowValueH - 1.8, 4.4));
    rowY += rowValueH;
    dividerYs.push(rowY);
  }

  // Every border line last, on top of the fills: thin internal dividers
  // first, then the thick outer frame, so the frame is one uninterrupted
  // stroke all the way around.
  pdf.setDrawColor(0);
  pdf.setLineWidth(THIN_LINE_MM);
  for (const dy of dividerYs) pdf.line(tbX, dy, tbX + titleBlockWidthMm, dy);
  pdf.setLineWidth(THICK_LINE_MM);
  pdf.rect(tbX, tbY, titleBlockWidthMm, drawAreaH);
  // The sheet's overall border (the on-screen preview's `border-2 border-black`
  // around the drawing area + title block together). It used to be implied by
  // each view cell's own frame, so a template with "hide view frame" on lost the
  // page border entirely in the PDF — draw it explicitly, drawn last so it sits
  // on top of the title block's own outline.
  pdf.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, drawAreaH);
  pdf.setLineWidth(THIN_LINE_MM);
}

// Single-product export — unchanged behaviour/signature for every existing
// caller: creates its own one-page document, draws the sheet, saves it.
export async function exportDrawingSheetPdf(params: {
  productName: string;
  companyName: string;
  logoDataUrl: string | null;
  titleBlockWidthMm: number;
  fieldRowMinHeightMm: number;
  fields: PdfTitleField[];
  views: PdfViewSpec[];
  showViewFrame: boolean;
}): Promise<void> {
  const pdf = await createA4Pdf();
  await addDrawingSheetPage(pdf, params);
  pdf.save(`${sanitizeFileName(params.productName)}-ban-ve.pdf`);
}
