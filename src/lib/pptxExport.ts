// Client-side .pptx generation via pptxgenjs — no backend needed, same
// spirit as the PDF export (use what's available in the browser instead
// of standing up a server just to produce a file).
import type PptxGenJSType from "pptxgenjs";
import {
  LAYOUTS,
  TINT_HEX,
  EXPORT_COLORS as COLORS,
  LOGO_PATH,
  LOGO_ASPECT,
  cellRect,
  innerRects,
  buildInfoRows,
  safeFileName,
  type ProductsPerSlide,
  type LayoutConfig,
  type ExportItem,
  type CoverTemplate,
  type InfoVisibility,
} from "@/lib/exportLayout";

export type { ProductsPerSlide, CoverTemplate };
export { PRODUCTS_PER_SLIDE_OPTIONS, LAYOUTS as CONTENT_LAYOUTS } from "@/lib/exportLayout";
export type PptxExportItem = ExportItem;

const FONT = "Arial";

export interface GeneratePptxOptions {
  collectionName: string;
  customer: string;
  date: string;
  items: PptxExportItem[];
  perSlide: ProductsPerSlide;
  template?: CoverTemplate;
  infoVisibility: InfoVisibility;
}

export async function generateCollectionPptx({
  collectionName,
  customer,
  date,
  items,
  perSlide,
  template,
  infoVisibility,
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
  const subLines = [customer ? `Gửi: ${customer}` : "", date].filter(Boolean);
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
    safeAddImage(slide, { path: LOGO_PATH, x: 0.4, y: 0.15, w: 1.3, h: 1.3 * LOGO_ASPECT });

    chunk.forEach((item, idx) => {
      const cell = cellRect(idx, layout);
      drawProductCell(slide, item, cell, layout.inner, layout.fontSizes, infoVisibility);
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

  await pptx.writeFile({ fileName: `${safeFileName(collectionName)}.pptx` });
}

function drawProductCell(
  slide: PptxGenJSType.Slide,
  item: ExportItem,
  cell: ReturnType<typeof cellRect>,
  inner: "LR" | "TB",
  fontSizes: LayoutConfig["fontSizes"],
  infoVisibility: InfoVisibility,
) {
  const rows = buildInfoRows(item, fontSizes, infoVisibility);
  const { image, info } = innerRects(cell, inner, rows.length > 0);

  if (item.mainImage) {
    safeAddImage(slide, { path: item.mainImage, ...image, sizing: { type: "cover", w: image.w, h: image.h } });
  } else {
    slide.addShape("roundRect", { ...image, fill: { color: TINT_HEX[item.tint] }, line: { color: TINT_HEX[item.tint] }, rectRadius: 0.06 });
  }

  let y = info.y;
  for (const row of rows) {
    const h = row.size / 62 + 0.06;
    slide.addText(row.text, { x: info.x, y, w: info.w, h, fontSize: row.size, bold: row.bold, color: row.color, fontFace: FONT });
    y += h;
  }
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
