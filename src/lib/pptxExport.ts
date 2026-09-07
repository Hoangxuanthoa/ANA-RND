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

export interface GeneratePptxOptions {
  collectionName: string;
  customer: string;
  note?: string;
  date: string;
  items: PptxExportItem[];
  perSlide: number;
}

export async function generateCollectionPptx({
  collectionName,
  customer,
  note,
  date,
  items,
  perSlide,
}: GeneratePptxOptions): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const logoW = 2;
  const logoH = logoW * LOGO_ASPECT;

  // Cover slide
  const cover = pptx.addSlide();
  cover.background = { color: COLORS.accent };
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

  // Content slides
  const cols = perSlide <= 2 ? 2 : perSlide <= 6 ? 3 : 3;
  const rows = Math.ceil(perSlide / cols);
  const gridTop = 1.25;
  const gridWidth = 9.2;
  const gridHeight = 3.95;
  const gapX = 0.25;
  const gapY = 0.3;
  const cellW = (gridWidth - gapX * (cols - 1)) / cols;
  const cellH = (gridHeight - gapY * (rows - 1)) / rows;
  const imgH = cellH * 0.55;

  for (let i = 0; i < items.length; i += perSlide) {
    const chunk = items.slice(i, i + perSlide);
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.white };
    safeAddImage(slide, { path: LOGO_PATH, x: 0.4, y: 0.3, w: 1.3, h: 1.3 * LOGO_ASPECT });
    slide.addText(collectionName, { x: 0.4, y: 0.75, w: 9, h: 0.35, fontSize: 15, bold: true, color: COLORS.text, fontFace: FONT });

    chunk.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 0.4 + col * (cellW + gapX);
      const y = gridTop + row * (cellH + gapY);

      if (item.mainImage) {
        safeAddImage(slide, { path: item.mainImage, x, y, w: cellW, h: imgH, sizing: { type: "cover", w: cellW, h: imgH } });
      } else {
        slide.addShape("roundRect", { x, y, w: cellW, h: imgH, fill: { color: TINT_HEX[item.tint] }, line: { color: TINT_HEX[item.tint] }, rectRadius: 0.06 });
      }

      const textY = y + imgH + 0.06;
      slide.addText(item.code, { x, y: textY, w: cellW, h: 0.24, fontSize: 11, bold: true, color: COLORS.text, fontFace: FONT });
      slide.addText(`${item.category} · ${item.material}`, {
        x,
        y: textY + 0.22,
        w: cellW,
        h: 0.2,
        fontSize: 9,
        color: COLORS.textMuted,
        fontFace: FONT,
      });
      slide.addText(item.sizeSummary, { x, y: textY + 0.4, w: cellW, h: 0.4, fontSize: 8.5, color: COLORS.textFaint, fontFace: FONT });
    });
  }

  // Closing slide
  const closing = pptx.addSlide();
  closing.background = { color: COLORS.accent };
  safeAddImage(closing, { path: LOGO_PATH, x: (10 - logoW) / 2, y: 1.9, w: logoW, h: logoH });
  closing.addText("Cảm ơn quý khách", {
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
