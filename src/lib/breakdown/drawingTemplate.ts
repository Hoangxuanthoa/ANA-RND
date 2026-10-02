// Drawing-sheet templates: which views to show, the title-block branding
// (logo/company) and which fields it has — all previously hardcoded
// directly in DrawingSheetA4.tsx (fixed 2x2 grid of exactly Front/Side/
// Top/Iso, fixed "Artex Nam An" branding, a fixed field list). Templates
// are GLOBAL — saved independently of any product, reused across all of
// them — since the same 2 sets of company branding get used for many
// different products, not just one.
import { loadState, saveState } from "./persistence";

// Front/Side/Top/Iso are the only views the geometry engines actually
// compute distinctly today (see drawingEngine.ts) — Back/Left/Right/Bottom
// reuse that SAME data (see TechnicalDrawing.tsx's DRAWING_VIEW_STATE_KEY):
// with every current shape's handle/material mounted symmetrically and no
// azimuthal asymmetry anywhere in the data model, a true opposite-side
// projection is mathematically identical to its counterpart today — not a
// faked duplicate, just what the real geometry actually looks like from
// there. If an asymmetric feature is ever added, these become genuinely
// distinct for free since they render from the same underlying data.
export type DrawingViewKey = "front" | "back" | "left" | "right" | "top" | "bottom" | "iso";

export const DRAWING_VIEW_LABELS: Record<DrawingViewKey, string> = {
  front: "Mặt đứng (Front)",
  back: "Mặt sau (Back)",
  left: "Mặt trái (Left)",
  right: "Mặt phải (Right)",
  top: "Mặt bằng (Top)",
  bottom: "Mặt đáy (Bottom)",
  iso: "Iso",
};

export const ALL_DRAWING_VIEWS: DrawingViewKey[] = ["front", "back", "left", "right", "top", "bottom", "iso"];

export interface DrawingTemplateField {
  id: string;
  label: string;
  // Only the DEFAULT template's own fields use these — a value seeded here
  // once when a doc is first created for this template, still freely
  // editable afterward per-drawing like any other field.
  autoFill?: "productName" | "today";
  // A fixed value to pre-fill this field with on every new drawing that
  // uses this template — e.g. a company address or a standard tolerance
  // note that's the same across most products, so the user doesn't have to
  // retype it each time. Ignored when autoFill is set (that always wins,
  // since it's computed per-drawing); still freely editable afterward like
  // any other field value.
  defaultValue?: string;
}

export interface DrawingTemplate {
  id: string;
  name: string; // the template's OWN name (e.g. "Công ty A") — not shown on the drawing itself
  companyName: string;
  logoDataUrl: string | null;
  views: DrawingViewKey[];
  fields: DrawingTemplateField[];
  // Width (mm) of the title-block column on the exported A4 page — also
  // drives the on-screen column's width, at the same proportion of the
  // sheet, so the preview always matches what prints.
  titleBlockWidthMm: number;
  // Minimum height (mm) of a single field row (label + value together) —
  // rows still stretch taller than this to fill spare vertical space when
  // there are few fields (see pdfExport.ts's rowH), but never shrink below
  // it. Also drives the on-screen row's minimum height at the same
  // proportion of the sheet.
  fieldRowMinHeightMm: number;
  // When false, each view's own border + name label (MẶT ĐỨNG, ISO, …) is
  // hidden — just the bare drawing floating in its grid cell, no box/label
  // around it. A per-template toggle, not a global switch, since some
  // sheets want the "shop drawing" boxed-and-labeled look and others want
  // plain ISO-style views with nothing around them.
  showViewFrame: boolean;
}

export const DEFAULT_TITLE_BLOCK_WIDTH_MM = 70;
export const DEFAULT_FIELD_ROW_MIN_HEIGHT_MM = 10.8;

function newFieldId(): string {
  return `f-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// A function, not a shared constant — same reasoning as
// geometry/types.ts's createDefaultMaterial: nested arrays need a FRESH
// copy per template, so editing one doesn't corrupt another's `fields`/
// `views` array reference.
export function createDefaultTemplate(): DrawingTemplate {
  return {
    id: `tpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: "Mặc định",
    companyName: "Artex Nam An",
    logoDataUrl: null,
    views: ["front", "left", "top", "iso"],
    titleBlockWidthMm: DEFAULT_TITLE_BLOCK_WIDTH_MM,
    fieldRowMinHeightMm: DEFAULT_FIELD_ROW_MIN_HEIGHT_MM,
    showViewFrame: true,
    fields: [
      { id: newFieldId(), label: "Tên bản vẽ", autoFill: "productName" },
      { id: newFieldId(), label: "Mã bản vẽ" },
      { id: newFieldId(), label: "Số lượng" },
      { id: newFieldId(), label: "Nguyên liệu" },
      { id: newFieldId(), label: "Xử lý bề mặt" },
      { id: newFieldId(), label: "Thiết kế" },
      { id: newFieldId(), label: "Người check" },
      { id: newFieldId(), label: "Ngày", autoFill: "today" },
      { id: newFieldId(), label: "Dung sai (mm)" },
    ],
  };
}

export function createBlankTemplate(name: string): DrawingTemplate {
  return {
    id: `tpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    companyName: "",
    logoDataUrl: null,
    views: ["front", "left", "top", "iso"],
    titleBlockWidthMm: DEFAULT_TITLE_BLOCK_WIDTH_MM,
    fieldRowMinHeightMm: DEFAULT_FIELD_ROW_MIN_HEIGHT_MM,
    showViewFrame: true,
    fields: [{ id: newFieldId(), label: "Tên bản vẽ", autoFill: "productName" }],
  };
}

// Auto-arranges N view cells into a grid that's never more than 1 row
// short of square (cols = ceil(sqrt(n))) — 4 stays 2×2 (unchanged from the
// old hardcoded layout), 5–6 become 3×2, 1–3 stay small. Shared by
// DrawingSheetA4.tsx's own CSS grid and pdfExport.ts's page layout so the
// on-screen preview and the exported PDF always agree on where each view
// lands.
export function computeGridLayout(n: number): { cols: number; rows: number } {
  const count = Math.max(n, 1);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

const TEMPLATES_KEY = "drawing-templates-v1";
export interface PersistedTemplates {
  templates: DrawingTemplate[];
  activeTemplateId: string;
}

export async function loadTemplates(): Promise<PersistedTemplates> {
  const saved = await loadState<PersistedTemplates>(TEMPLATES_KEY);
  if (saved && saved.templates?.length) {
    // Forward-compat: templates saved before titleBlockWidthMm/
    // fieldRowMinHeightMm existed still deserialize fine, just missing the
    // fields — fill them in here rather than making every reader handle
    // `undefined`.
    return {
      ...saved,
      templates: saved.templates.map((t) => ({
        ...t,
        titleBlockWidthMm: t.titleBlockWidthMm ?? DEFAULT_TITLE_BLOCK_WIDTH_MM,
        fieldRowMinHeightMm: t.fieldRowMinHeightMm ?? DEFAULT_FIELD_ROW_MIN_HEIGHT_MM,
        showViewFrame: t.showViewFrame ?? true,
      })),
    };
  }
  const def = createDefaultTemplate();
  return { templates: [def], activeTemplateId: def.id };
}

export async function saveTemplates(state: PersistedTemplates): Promise<void> {
  await saveState(TEMPLATES_KEY, state);
}
