// Direct-download PDF export — draws real vector text and directly
// embeds real images via jsPDF, same spirit and same layout geometry
// (src/lib/exportLayout.ts) as the PPTX export, instead of screenshotting
// the on-page HTML preview (the old approach, which made the PDF's text
// a raster image — not sharp, not selectable, not searchable).
//
// jsPDF's built-in fonts (Helvetica/Times/Courier) don't cover Vietnamese
// diacritics, so a real Unicode-capable font (Lato, OFL-licensed, same
// family Google ships) is fetched from /public/fonts and embedded at
// generation time — see public/fonts/Lato-OFL.txt for the license.

import {
  SLIDE_W_IN,
  SLIDE_H_IN,
  LAYOUTS,
  TINT_HEX,
  EXPORT_COLORS,
  LOGO_PATH,
  LOGO_ASPECT,
  cellRect,
  innerRects,
  buildInfoRows,
  safeFileName,
  type ProductsPerSlide,
  type ExportItem,
  type CoverTemplate,
  type Rect,
  type InfoVisibility,
} from "@/lib/exportLayout";

const DPI = 200; // rasterization density for embedded images (px per inch)
const FONT_NAME = "Lato";

function hex(h: string): [number, number, number] {
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`Failed to read ${url}`));
    reader.readAsDataURL(blob);
  });
}

// Any real http(s) image (a product photo, or a PPTX-template cover/
// closing image — both R2-hosted) has to go through our own image proxy
// before it's safe to read back off a canvas — see cropImage.ts's
// loadImage for the full story: R2's free public URL doesn't send
// Access-Control-Allow-Origin, so drawing one straight onto a canvas
// taints it and canvas.toDataURL() throws. blob: URLs (session-only
// picks) and root-relative paths (the /logo.png asset) are already
// same-origin and load directly.
function loadImage(url: string): Promise<HTMLImageElement> {
  const src = url.startsWith("blob:") || url.startsWith("/") ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${url}`));
    img.src = src;
  });
}

// Renders `url` into a canvas cropped/scaled to fill a `wIn x hIn` (inches)
// box — CSS object-fit:cover semantics — and returns it as a PNG data
// URL at DPI resolution, so jsPDF can place it at that exact box with no
// further stretching/distortion.
async function coverImageDataUrl(url: string, wIn: number, hIn: number): Promise<string> {
  const img = await loadImage(url);
  const dw = Math.max(1, Math.round(wIn * DPI));
  const dh = Math.max(1, Math.round(hIn * DPI));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = dw / dh;
  let sx: number, sy: number, sw: number, sh: number;
  if (srcRatio > dstRatio) {
    sh = img.naturalHeight;
    sw = sh * dstRatio;
    sy = 0;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sw = img.naturalWidth;
    sh = sw / dstRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas.toDataURL("image/png");
}

// A best-effort image placement — a bad/revoked blob: URL shouldn't fail
// the whole export, just that one picture (falls back to a colored box
// wherever this is called for a product photo).
async function safeAddImage(doc: import("jspdf").jsPDF, url: string, rect: Rect): Promise<boolean> {
  try {
    const dataUrl = await coverImageDataUrl(url, rect.w, rect.h);
    doc.addImage(dataUrl, "PNG", rect.x, rect.y, rect.w, rect.h);
    return true;
  } catch {
    return false;
  }
}

function drawFilledRect(doc: import("jspdf").jsPDF, rect: Rect, colorHex: string, radius = 0) {
  doc.setFillColor(...hex(colorHex));
  if (radius > 0) doc.roundedRect(rect.x, rect.y, rect.w, rect.h, radius, radius, "F");
  else doc.rect(rect.x, rect.y, rect.w, rect.h, "F");
}

function setFont(doc: import("jspdf").jsPDF, bold: boolean) {
  doc.setFont(FONT_NAME, bold ? "bold" : "normal");
}

async function drawBackground(doc: import("jspdf").jsPDF, backgroundImage: string | undefined) {
  if (!backgroundImage) {
    drawFilledRect(doc, { x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN }, EXPORT_COLORS.accent);
    return;
  }
  const ok = await safeAddImage(doc, backgroundImage, { x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN });
  if (!ok) {
    drawFilledRect(doc, { x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN }, EXPORT_COLORS.accent);
    return;
  }
  // Dark overlay so white text stays legible over any photo.
  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.55 }));
  drawFilledRect(doc, { x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN }, "000000");
  doc.restoreGraphicsState();
}

async function drawProductCell(doc: import("jspdf").jsPDF, item: ExportItem, cell: Rect, inner: "LR" | "TB", fontSizes: { code: number; meta: number; size: number }, infoVisibility: InfoVisibility) {
  const rows = buildInfoRows(item, fontSizes, infoVisibility);
  const { image, info } = innerRects(cell, inner, rows.length > 0);

  const placed = item.mainImage ? await safeAddImage(doc, item.mainImage, image) : false;
  if (!placed) drawFilledRect(doc, image, TINT_HEX[item.tint], 0.06);

  let y = info.y;
  for (const row of rows) {
    setFont(doc, !!row.bold);
    doc.setFontSize(row.size);
    doc.setTextColor(...hex(row.color));
    const lineH = row.size / 62 + 0.06;
    // Narrow cells (mode 6's LR columns especially) can force "Item code:
    // RND-00125" to wrap — measure the actual wrapped line count instead
    // of assuming one line, so the next row never overlaps this one.
    const lines = doc.splitTextToSize(row.text, info.w) as string[];
    lines.forEach((line, i) => doc.text(line, info.x, y + i * lineH, { baseline: "top" }));
    y += lineH * lines.length;
  }
}

export interface GeneratePdfOptions {
  collectionName: string;
  customer: string;
  date: string;
  items: ExportItem[];
  perSlide: ProductsPerSlide;
  template?: CoverTemplate;
  infoVisibility: InfoVisibility;
}

export async function generateCollectionPdf({
  collectionName,
  customer,
  date,
  items,
  perSlide,
  template,
  infoVisibility,
}: GeneratePdfOptions): Promise<void> {
  const [{ jsPDF }, regularFont, boldFont] = await Promise.all([
    import("jspdf"),
    fetchAsBase64("/fonts/Lato-Regular.ttf"),
    fetchAsBase64("/fonts/Lato-Bold.ttf"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "in", format: [SLIDE_W_IN, SLIDE_H_IN] });
  doc.addFileToVFS("Lato-Regular.ttf", regularFont);
  doc.addFont("Lato-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("Lato-Bold.ttf", boldFont);
  doc.addFont("Lato-Bold.ttf", FONT_NAME, "bold");

  const logoW = 2;
  const logoH = logoW * LOGO_ASPECT;

  // Cover
  await drawBackground(doc, template?.backgroundImage);
  await safeAddImage(doc, LOGO_PATH, { x: 0.5, y: 0.45, w: logoW, h: logoH });
  setFont(doc, true);
  doc.setFontSize(34);
  doc.setTextColor(...hex(EXPORT_COLORS.white));
  doc.text(collectionName, 0.5, 2.4, { baseline: "top", maxWidth: 9 });

  const subLines = [customer ? `Gửi: ${customer}` : "", date].filter(Boolean);
  setFont(doc, false);
  doc.setFontSize(13);
  let subY = 3.35;
  for (const line of subLines) {
    doc.text(line, 0.5, subY, { baseline: "top" });
    subY += 0.28;
  }

  // Content slides
  const layout = LAYOUTS[perSlide];
  for (let i = 0; i < items.length; i += perSlide) {
    const chunk = items.slice(i, i + perSlide);
    doc.addPage([SLIDE_W_IN, SLIDE_H_IN], "landscape");
    drawFilledRect(doc, { x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN }, EXPORT_COLORS.white);
    await safeAddImage(doc, LOGO_PATH, { x: 0.4, y: 0.15, w: 1.3, h: 1.3 * LOGO_ASPECT });

    for (let idx = 0; idx < chunk.length; idx++) {
      const cell = cellRect(idx, layout);
      await drawProductCell(doc, chunk[idx], cell, layout.inner, layout.fontSizes, infoVisibility);
    }
  }

  // Closing
  doc.addPage([SLIDE_W_IN, SLIDE_H_IN], "landscape");
  await drawBackground(doc, template?.closingBackgroundImage);
  await safeAddImage(doc, LOGO_PATH, { x: (SLIDE_W_IN - logoW) / 2, y: 1.9, w: logoW, h: logoH });
  setFont(doc, true);
  doc.setFontSize(26);
  doc.setTextColor(...hex(EXPORT_COLORS.white));
  doc.text(template?.closingText?.trim() || "Cảm ơn quý khách", SLIDE_W_IN / 2, 3.1, { baseline: "top", align: "center" });

  doc.save(`${safeFileName(collectionName)}.pdf`);
}
