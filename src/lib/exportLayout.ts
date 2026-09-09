// Shared geometry between the two real Collection export formats
// (PPTX via pptxgenjs, PDF via jsPDF) and the on-page HTML preview
// (CollectionSlideDeck.tsx) — one definition of the 5 fixed content-slide
// layouts, so the three consumers can't quietly drift out of sync with
// each other. Units are inches, on a 10 x 5.625in (16:9) page/slide —
// both pptxgenjs's LAYOUT_16x9 and the PDF's page size use this exact
// size, so the same coordinates place things identically in both.

export type ProductsPerSlide = 1 | 2 | 3 | 4 | 6;
export const PRODUCTS_PER_SLIDE_OPTIONS: ProductsPerSlide[] = [1, 2, 3, 4, 6];

export const SLIDE_W_IN = 10;
export const SLIDE_H_IN = 5.625;

// Minus header space for the logo — content slides show just the logo
// (no collection name repeated per page, already on the cover).
export const CONTENT_AREA = { x: 0.4, y: 0.75, w: 9.2, h: 4.55 };
export const GAP = 0.25;

export interface LayoutConfig {
  cols: number;
  rows: number;
  inner: "LR" | "TB"; // per-cell layout: left-image/right-info, or top-image/bottom-info
  fontSizes: { code: number; meta: number; size: number };
}

// The 5 fixed content-slide layouts the user asked for — not a generic
// auto-grid, each count has its own deliberate look:
//   1 → one block filling the slide, image left / info right
//   2 → 2 columns side by side, each block image top / info bottom
//   3 → 3 columns side by side (1 row), each block image top / info bottom
//   4 → 2x2 grid, each cell image left / info right
//   6 → 2x3 grid (2 rows, 3 cols), each cell image left / info right
export const LAYOUTS: Record<ProductsPerSlide, LayoutConfig> = {
  1: { cols: 1, rows: 1, inner: "LR", fontSizes: { code: 20, meta: 14, size: 12 } },
  2: { cols: 2, rows: 1, inner: "TB", fontSizes: { code: 16, meta: 12, size: 10.5 } },
  3: { cols: 3, rows: 1, inner: "TB", fontSizes: { code: 14, meta: 11, size: 9.5 } },
  4: { cols: 2, rows: 2, inner: "LR", fontSizes: { code: 13, meta: 10.5, size: 9 } },
  6: { cols: 3, rows: 2, inner: "LR", fontSizes: { code: 11, meta: 9, size: 8.5 } },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cellRect(index: number, layout: Pick<LayoutConfig, "cols" | "rows">): Rect {
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

// Splits one product cell into its image box and info (text) box,
// depending on the mode's inner layout.
export function innerRects(cell: Rect, inner: "LR" | "TB"): { image: Rect; info: Rect } {
  const gap = 0.12;
  const image: Rect =
    inner === "LR"
      ? { x: cell.x, y: cell.y, w: cell.w * 0.42, h: cell.h }
      : { x: cell.x, y: cell.y, w: cell.w, h: cell.h * 0.55 };
  const info: Rect =
    inner === "LR"
      ? { x: cell.x + cell.w * 0.42 + gap, y: cell.y, w: cell.w * 0.58 - gap, h: cell.h }
      : { x: cell.x, y: cell.y + cell.h * 0.55 + gap, w: cell.w, h: cell.h * 0.45 - gap };
  return { image, info };
}

export interface ExportItem {
  code: string;
  category: string;
  material: string;
  // One line per size variant (e.g. "S: 40 x 40 x 45 cm") — empty when the
  // product has no size variants, rendered as a single "—" line instead.
  sizeLines: string[];
  mainImage?: string;
  tint: "accent" | "blue" | "green" | "slate" | "amber";
}

// Rough hex equivalents of the app's oklch tint tokens (globals.css) —
// neither pptxgenjs nor jsPDF understand CSS custom properties.
export const TINT_HEX: Record<ExportItem["tint"], string> = {
  accent: "E3F6E1",
  green: "E3F6E1",
  blue: "E3ECFB",
  slate: "E9EAEE",
  amber: "FBEEDB",
};

export const EXPORT_COLORS = {
  accent: "1C8F18",
  white: "FFFFFF",
  text: "1F1F1F",
  textMuted: "6B6B6B",
  textFaint: "9A9A9A",
};

export const LOGO_PATH = "/logo.png";
export const LOGO_ASPECT = 210 / 738;

export interface CoverTemplate {
  backgroundImage?: string;
  closingBackgroundImage?: string;
  closingText: string;
}

export interface InfoRow {
  text: string;
  size: number;
  bold?: boolean;
  color: string;
}

// Fixed labeled rows, one per line: Item code / Category / Material /
// Dimension: (header) / one line per size variant (or "—" if none).
export function buildInfoRows(item: ExportItem, fontSizes: LayoutConfig["fontSizes"]): InfoRow[] {
  return [
    { text: `Item code: ${item.code}`, size: fontSizes.code, bold: true, color: EXPORT_COLORS.text },
    { text: `Category: ${item.category}`, size: fontSizes.meta, color: EXPORT_COLORS.textMuted },
    { text: `Material: ${item.material}`, size: fontSizes.meta, color: EXPORT_COLORS.textMuted },
    { text: "Dimension:", size: fontSizes.meta, color: EXPORT_COLORS.textMuted },
    ...(item.sizeLines.length > 0 ? item.sizeLines : ["—"]).map((line) => ({
      text: line,
      size: fontSizes.size,
      color: EXPORT_COLORS.textFaint,
    })),
  ];
}

export function safeFileName(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "collection";
}
