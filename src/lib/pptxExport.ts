// Client-side .pptx generation via pptxgenjs — no backend needed, same
// spirit as the print-to-PDF export (use what's available in the browser
// instead of standing up a server just to produce a file).
import type PptxGenJSType from "pptxgenjs";

export interface PptxExportItem {
  code: string;
  category: string;
  material: string;
  sizeSummary: string;
  mainImage?: string;
  tint: "accent" | "blue" | "green" | "slate" | "amber";
}

// The 5 fixed content-slide layouts the user asked for — not a generic
// auto-grid, each count has its own deliberate look:
//   1 → one block filling the slide, image left / info right
//   2 → 2 columns side by side, each block image top / info bottom
//   3 → 3 columns side by side (1 row), each block image top / info bottom
//   4 → 2x2 grid, each cell image left / info right
//   6 → 2x3 grid (2 rows, 3 cols), each cell image left / info right
export type ProductsPerSlide = 1 | 2 | 3 | 4 | 6;
export const PRODUCTS_PER_SLIDE_OPTIONS: ProductsPerSlide[] = [1, 2, 3, 4, 6];

// Rough hex equivalents of the app's oklch tint tokens (globals.css) —
// pptxgenjs needs plain hex, no CSS custom properties.
const TINT_HEX: Record<PptxExportItem["tint"], string> = {
  accent: "E3F6E1",
  green: "E3F6E1",
  blue: "E3ECFB",
  slate: "E9EAEE",
  amber: "FBEEDB",
};

const COLORS = {
  accent: "1C8F18",
  white: "FFFFFF",
  text: "1F1F1F",
  textMuted: "6B6B6B",
  textFaint: "9A9A9A",
};

const FONT = "Arial";
const LOGO_PATH = "/logo.png";
const LOGO_ASPECT = 210 / 738;

// 10in x 5.625in slide (LAYOUT_16x9), minus header space for logo/title.
const CONTENT_AREA = { x: 0.4, y: 1.0, w: 9.2, h: 4.3 };
const GAP = 0.25;

interface LayoutConfig {
  cols: number;
  rows: number;
  inner: "LR" | "TB"; // per-cell layout: left-image/right-info, or top-image/bottom-info
  fontSizes: { code: number; meta: number; size: number };
}

const LAYOUTS: Record<ProductsPerSlide, LayoutConfig> = {
  1: { cols: 1, rows: 1, inner: "LR", fontSizes: { code: 20, meta: 14, size: 12 } },
  2: { cols: 2, rows: 1, inner: "TB", fontSizes: { code: 16, meta: 12, size: 10.5 } },
  3: { cols: 3, rows: 1, inner: "TB", fontSizes: { code: 14, meta: 11, size: 9.5 } },
  4: { cols: 2, rows: 2, inner: "LR", fontSizes: { code: 13, meta: 10.5, size: 9 } },
  6: { cols: 3, rows: 2, inner: "LR", fontSizes: { code: 11, meta: 9, size: 8.5 } },
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cellRect(index: number, layout: LayoutConfig): Rect {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  const w = (CONTENT_AREA.w - GAP * (layout.cols - 1)) / layout.cols;
  const h = (CONTENT_AREA.h - GAP * (layout.rows - 1)) / layout.rows;
  return {
    x: CONTENT_AREA.x + col * (w + GAP),
    y: CONTENT_AREA.y + row * (h + GAP),
    w,
    h,
  };
}

export interface CoverTemplate {
  backgroundImage?: string;
  closingBackgroundImage?: string;
  closingText: string;
}

export interface GeneratePptxOptions {
  collectionName: string;
  customer: string;
  note?: string;
  date: string;
  items: PptxExportItem[];
  perSlide: ProductsPerSlide;
  template?: CoverTemplate;
}

export async function generateCollectionPptx({
  collectionName,
  customer,
  note,
  date,
  items,
  perSlide,
  template,
}: GeneratePptxOptions): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const logoW = 2;
  const logoH = logoW * LOGO_ASPECT;

  // Cover slide
  const cover = pptx.addSlide();
  addCoverBackground(cover, template?.backgroundImage);
  safeAddImage(cover, { path: LOGO_PATH, x: 0.5, y: 0.45, w: logoW, h: logoH });
  cover.addText(collectionName, {
    x: 0.5,
    y: 2.1,
    w: 9,
    h: 1.3,
    fontSize: 34,
    bold: true,
    color: COLORS.white,
    fontFace: FONT,
  });
  const subLines = [customer ? `Gửi: ${customer}` : "", note?.trim() ?? "", date].filter(Boolean);
  cover.addText(subLines.join("\n"), {
    x: 0.5,
    y: 3.35,
    w: 9,
    h: 1.2,
    fontSize: 13,
    color: COLORS.white,
    fontFace: FONT,
    lineSpacingMultiple: 1.5,
  });

  // Content slides — same fixed layout (slot positions) reused for every
  // slide of a given mode, including a final partial slide (fewer items
  // than perSlide just leaves the remaining slots empty rather than
  // switching to a different mode).
  const layout = LAYOUTS[perSlide];
  for (let i = 0; i < items.length; i += perSlide) {
    const chunk = items.slice(i, i + perSlide);
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.white };
    safeAddImage(slide, { path: LOGO_PATH, x: 0.4, y: 0.3, w: 1.3, h: 1.3 * LOGO_ASPECT });
    slide.addText(collectionName, { x: 0.4, y: 0.75, w: 9, h: 0.35, fontSize: 15, bold: true, color: COLORS.text, fontFace: FONT });

    chunk.forEach((item, idx) => {
      const cell = cellRect(idx, layout);
      drawProductCell(slide, item, cell, layout.inner, layout.fontSizes);
    });
  }

  // Closing slide
  const closing = pptx.addSlide();
  addCoverBackground(closing, template?.closingBackgroundImage);
  safeAddImage(closing, { path: LOGO_PATH, x: (10 - logoW) / 2, y: 1.9, w: logoW, h: logoH });
  closing.addText(template?.closingText?.trim() || "Cảm ơn quý khách", {
    x: 0.5,
    y: 2.9,
    w: 9,
    h: 0.8,
    fontSize: 26,
    bold: true,
    color: COLORS.white,
    align: "center",
    fontFace: FONT,
  });

  const safeName = collectionName.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "collection";
  await pptx.writeFile({ fileName: `${safeName}.pptx` });
}

function drawProductCell(
  slide: PptxGenJSType.Slide,
  item: PptxExportItem,
  cell: Rect,
  inner: "LR" | "TB",
  fontSizes: LayoutConfig["fontSizes"],
) {
  const gap = 0.12;
  const image: Rect =
    inner === "LR"
      ? { x: cell.x, y: cell.y, w: cell.w * 0.42, h: cell.h }
      : { x: cell.x, y: cell.y, w: cell.w, h: cell.h * 0.55 };
  const info: Rect =
    inner === "LR"
      ? { x: cell.x + cell.w * 0.42 + gap, y: cell.y, w: cell.w * 0.58 - gap, h: cell.h }
      : { x: cell.x, y: cell.y + cell.h * 0.55 + gap, w: cell.w, h: cell.h * 0.45 - gap };

  if (item.mainImage) {
    safeAddImage(slide, { path: item.mainImage, ...image, sizing: { type: "cover", w: image.w, h: image.h } });
  } else {
    slide.addShape("roundRect", { ...image, fill: { color: TINT_HEX[item.tint] }, line: { color: TINT_HEX[item.tint] }, rectRadius: 0.06 });
  }

  const lineH = fontSizes.code / 62; // rough inches-per-line at this font size
  slide.addText(item.code, { x: info.x, y: info.y, w: info.w, h: lineH + 0.1, fontSize: fontSizes.code, bold: true, color: COLORS.text, fontFace: FONT });
  slide.addText(`${item.category} · ${item.material}`, {
    x: info.x,
    y: info.y + lineH + 0.1,
    w: info.w,
    h: lineH + 0.06,
    fontSize: fontSizes.meta,
    color: COLORS.textMuted,
    fontFace: FONT,
  });
  slide.addText(item.sizeSummary, {
    x: info.x,
    y: info.y + (lineH + 0.1) * 2,
    w: info.w,
    h: info.h - (lineH + 0.1) * 2,
    fontSize: fontSizes.size,
    color: COLORS.textFaint,
    fontFace: FONT,
  });
}

// Cover/closing background: a user-supplied image (from Settings) with a
// dark overlay so white text stays legible over any photo, or the flat
// brand green when no image is configured.
function addCoverBackground(slide: PptxGenJSType.Slide, backgroundImage?: string) {
  if (!backgroundImage) {
    slide.background = { color: COLORS.accent };
    return;
  }
  safeAddImage(slide, { path: backgroundImage, x: 0, y: 0, w: 10, h: 5.63, sizing: { type: "cover", w: 10, h: 5.63 } });
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 5.63, fill: { color: "000000", transparency: 55 }, line: { type: "none" } });
}

// pptxgenjs resolves `path` images lazily when writing the file — a bad
// blob: URL (e.g. one already revoked) throws there, not here. Since this
// is a best-effort visual (a colored placeholder is an acceptable
// fallback), swallow failures per-image rather than aborting the whole
// export.
function safeAddImage(slide: PptxGenJSType.Slide, opts: Parameters<PptxGenJSType.Slide["addImage"]>[0]) {
  try {
    slide.addImage(opts);
  } catch {
    // ignore — slide just won't have this image
  }
}
