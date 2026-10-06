"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FrontSideSVG, IsoSVG, TopSVG, type CustomDim, type DimPickMode, type DimSettings, type DimSettingsMap, type DrawMode, type Note, type TextBoxItem } from "./TechnicalDrawing";
import { TemplateManager } from "./TemplateManager";
import {
  addDrawingSheetPage,
  createA4Pdf,
  exportDrawingSheetPdf,
  computeCellContentHeightMm,
  sanitizeFileName,
  ROW_LABEL_WEIGHT,
  ROW_VALUE_WEIGHT,
  type PdfTitleField,
  type PdfViewSpec,
} from "@/lib/breakdown/pdfExport";
import {
  computeGridLayout,
  createDrawingTemplateRemote,
  deleteDrawingTemplateRemote,
  DRAWING_VIEW_LABELS,
  fetchDrawingTemplates,
  loadActiveTemplateId,
  saveActiveTemplateId,
  updateDrawingTemplateRemote,
  type DrawingTemplate,
  type DrawingViewKey,
} from "@/lib/breakdown/drawingTemplate";
import type { SteelFrameResult } from "@/lib/breakdown/geometry/frameEngine";
import { DEFAULT_ISO_ANGLE, ISO_ELEVATION_RANGE, type IsoAngle, type ShapeDrawingInput } from "@/lib/breakdown/geometry/drawingEngine";
import type { HandleInput, MaterialInput } from "@/lib/breakdown/geometry/types";
import { canManageDrawingTemplates } from "@/lib/permissions";
import { SHEET_PART_LABEL, type SheetPart } from "@/lib/breakdown/drawingBundle";
import { useRole } from "@/components/RoleProvider";

type Point3 = { x: number; y: number; z: number };

interface TitleBlockField {
  id: string;
  label: string;
  value: string;
}

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fieldValue(field: DrawingTemplate["fields"][number], productName: string): string {
  if (field.autoFill === "productName") return productName;
  if (field.autoFill === "today") return todayDDMMYYYY();
  return field.defaultValue ?? "";
}

// The geometry engines only ever compute Front/Side/Top/Iso distinctly
// (see drawingEngine.ts) — Back/Left/Right/Bottom reuse that SAME
// underlying data (see drawingTemplate.ts's own comment for why that's
// accurate, not a shortcut) — this just says WHICH of the 4 real state
// buckets (notes/dimSettings/customDims/viewScale) each template view key
// reads and writes.
type ViewKey = "front" | "side" | "top" | "iso";
const DRAWING_VIEW_STATE_KEY: Record<DrawingViewKey, ViewKey> = {
  front: "front",
  back: "front",
  left: "side",
  right: "side",
  top: "top",
  bottom: "top",
  iso: "iso",
};

// Per-view display: null denominator = auto-fit (see orthoHalfExtent in
// TechnicalDrawing.tsx); a number = a real "1:x" scale for THIS view only —
// each view can be set independently, since a true isometric projection
// naturally fills its own frame more than an orthographic elevation does
// at the identical real scale (more of the object's surface is visible at
// once), so "one scale fits all" can't make every view look equally full —
// panX/panY (mm) let the user drag the object off the auto-centred
// position within that same frame, e.g. to zoom into one area.
interface ViewScaleState {
  denominator: number | null;
  panX: number;
  panY: number;
}
const DEFAULT_VIEW_SCALE: ViewScaleState = { denominator: null, panX: 0, panY: 0 };
// The denominator a view starts at the moment it's switched from "Tự động"
// to "1:x" — Iso defaults higher than the others (7 vs 5) since, at the
// same starting point, it visibly fills its frame more than an orthographic
// view does (see ViewScaleState's own comment) and 7 was confirmed to look
// balanced against Front/Side/Top's own default of 5.
const DEFAULT_DENOMINATOR: Record<ViewKey, number> = { front: 5, side: 5, top: 5, iso: 7 };

// Click-to-select across every dim/note/text-box kind, scoped to the view it
// was clicked in — Delete removes it, the "Mục đang chọn" panel can give it
// its own color/size independent of the sheet-wide dimColor/fontScale.
type SelectionKind = "dim" | "customDim" | "note" | "textbox";
interface Selection {
  view: ViewKey;
  kind: SelectionKind;
  id: string;
}

function ViewCell({
  label,
  visible,
  showFrame,
  contentRef,
  children,
}: {
  label: string;
  visible: boolean;
  // Per-template option (DrawingTemplate.showViewFrame) — off hides both
  // the border around this cell and its name strip, leaving just the bare
  // drawing floating in its grid cell (some sheets want the "shop drawing"
  // boxed-and-labeled look, others prefer plain ISO-style views).
  showFrame: boolean;
  contentRef?: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={showFrame ? "flex min-h-0 flex-col rounded-md border border-black bg-white" : "flex min-h-0 flex-col bg-white"}>
      {showFrame && (
        <div className="flex-shrink-0 border-b border-black px-2 py-0.5 text-[10px] font-bold tracking-wide text-black uppercase">{label}</div>
      )}
      <div ref={contentRef} className="min-h-0 flex-1 p-3">
        {visible ? children : <div className="flex h-full items-center justify-center text-[11px] text-text-faint">Đã ẩn</div>}
      </div>
    </div>
  );
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10.5px] font-bold tracking-wide text-text-faint uppercase">{title}</span>
      {children}
    </div>
  );
}

// A ControlGroup whose content collapses into a closes-on-outside-click
// dropdown instead of always taking up sidebar space — used for the
// sections that are only tweaked occasionally (which views show, font
// size/color, display scale), so the sidebar stays short by default.
function DropdownGroup({ title, summary, children }: { title: string; summary: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);
  return (
    <ControlGroup title={title}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
        >
          {summary}
          <span className="text-[10px]">{open ? "▲" : "▼"}</span>
        </button>
        {open && <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-line bg-white p-2 shadow-lg">{children}</div>}
      </div>
    </ControlGroup>
  );
}

const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 6;
// Quick picks for "Màu chữ" — common drafting colors so the user isn't
// forced through the RGB picker for an everyday change. The RGB input
// stays available right next to these for anything else.
const DIM_COLOR_PRESETS = [
  { value: "#000000", name: "Đen" },
  { value: "#2f6fb3", name: "Xanh dương" },
  { value: "#c0392b", name: "Đỏ" },
  { value: "#1e8449", name: "Xanh lá" },
  { value: "#7a5c00", name: "Vàng đồng" },
  { value: "#555555", name: "Xám" },
];

const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const A4_RATIO = PAGE_W_MM / PAGE_H_MM;
// Standard drafting-frame margin (ISO 5457) — the drawing's own border/
// content sits this far in from the physical paper edge on every side,
// instead of running flush to it. Matches pdfExport.ts's own MARGIN
// constant so the on-screen preview, "Xuất ảnh"/"Copy ảnh" (which rasterize
// this same DOM), and the PDF all agree on where the frame sits.
const PAGE_MARGIN_MM = 10;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const SHEET_PADDING = 32; // the scroll container's own p-4 (16px) on each side
const UNDO_DEBOUNCE_MS = 500;
const UNDO_STACK_LIMIT = 50;

// Everything undo-able about the sheet — its actual CONTENT, as opposed to
// pure view/session state (zoom/pan, which mode a toolbar button is in,
// whether a PDF export is in flight) that undo shouldn't touch. Consolidated
// into one object so a single commit()/undo()/redo() covers every field
// edit, dim tweak, note, and custom-measure at once, the same
// burst-debounced history-stack pattern PhotoTraceForm.tsx already uses.
export interface DocState {
  fields: TitleBlockField[];
  visible: Partial<Record<DrawingViewKey, boolean>>;
  mode: DrawMode;
  fontScale: number;
  dimColor: string;
  notes: Record<ViewKey, Note[]>;
  textBoxes: Record<ViewKey, TextBoxItem[]>;
  dimSettings: Record<ViewKey, DimSettingsMap>;
  customDims: Record<ViewKey, CustomDim[]>;
  viewScale: Record<ViewKey, ViewScaleState>;
  // Camera for the Iso view (xoay trái/phải + nghiêng lên/xuống, in degrees).
  isoAngle: IsoAngle;
}

interface DrawingSheetContentProps {
  drawing: ShapeDrawingInput;
  productName: string;
  frameResult: SteelFrameResult | null;
  handle: HandleInput;
  handleArcView: "front" | "side";
  handlePaths: Point3[][];
  material: MaterialInput;
  template: DrawingTemplate;
  onOpenManager: () => void;
  templateOptions: { id: string; name: string }[];
  activeTemplateId: string;
  onSelectTemplate: (id: string) => void;
  onClose: () => void;
  // Fires once after this sheet's first render, with the exact same
  // {views, fields} shape handleExportPdf below builds for a single export —
  // used by the "Xuất gộp nhiều sản phẩm" flow, which mounts one of these
  // per selected product OFF-SCREEN (see MultiDrawingExport.tsx) purely to
  // get at its rendered SVGs, never shown to the user directly.
  onCaptured?: (capture: { views: PdfViewSpec[]; fields: PdfTitleField[] }) => void;
  // The product's last saved sheet session (ProductState.drawingDoc), applied
  // once when this sheet mounts; onDocChange fires with the new doc after
  // every edit so the caller can save it back onto the product. Both are
  // omitted by the off-screen multi-export mount that must not write back.
  initialDoc?: unknown;
  onDocChange?: (doc: DocState) => void;
}

const clampElevation = (deg: number) => Math.min(ISO_ELEVATION_RANGE.max, Math.max(ISO_ELEVATION_RANGE.min, deg));
// Keeps azimuth in (-180, 180] so the slider/number box never drifts out of range.
const wrapAzimuth = (deg: number) => {
  const m = ((((deg + 180) % 360) + 360) % 360) - 180;
  return m === -180 ? 180 : m;
};

// A sheet saved before the product had a lid carries the plain product name in its
// title block. Once the product has Thân + Nắp sheets, bring that untouched name
// in line with the part ("… — Thân") — a name the person typed themselves stays.
export function withPartName(doc: unknown, plainName: string, partName: string): unknown {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as DocState).fields)) return doc;
  const d = doc as DocState;
  return { ...d, fields: d.fields.map((f) => (f.value === plainName ? { ...f, value: partName } : f)) };
}

const EMPTY_VIEW_BUCKETS = ["front", "side", "top", "iso"] as const;

// Builds the sheet's starting doc: the defaults, overlaid with a previously
// saved session when there is one. A saved doc is treated as untrusted-ish
// (older app versions, template edits since) — anything missing or no longer
// valid falls back to the default, title-block fields/views are re-matched
// against the CURRENT template by id, and "frame" mode is dropped if this
// product has no steel frame anymore.
function buildInitialDoc(template: DrawingTemplate, productName: string, frameResult: SteelFrameResult | null, saved: unknown): DocState {
  const defaults: DocState = {
    fields: template.fields.map((f) => ({ id: f.id, label: f.label, value: fieldValue(f, productName) })),
    visible: Object.fromEntries(template.views.map((k) => [k, true])),
    mode: frameResult ? "frame" : "solid",
    fontScale: 1.8,
    dimColor: "#000000",
    notes: { front: [], side: [], top: [], iso: [] },
    textBoxes: { front: [], side: [], top: [], iso: [] },
    dimSettings: { front: {}, side: {}, top: {}, iso: {} },
    customDims: { front: [], side: [], top: [], iso: [] },
    viewScale: { front: DEFAULT_VIEW_SCALE, side: DEFAULT_VIEW_SCALE, top: DEFAULT_VIEW_SCALE, iso: DEFAULT_VIEW_SCALE },
    isoAngle: DEFAULT_ISO_ANGLE,
  };
  if (!saved || typeof saved !== "object") return defaults;
  const s = saved as Partial<DocState>;
  const bucketsOk = (v: unknown) => !!v && typeof v === "object" && EMPTY_VIEW_BUCKETS.every((k) => k in (v as object));
  const savedFields = Array.isArray(s.fields) ? new Map(s.fields.map((f) => [f.id, f])) : new Map<string, TitleBlockField>();
  return {
    fields: defaults.fields.map((f) => {
      const old = savedFields.get(f.id);
      return old && typeof old.value === "string" ? { ...f, value: old.value } : f;
    }),
    visible: { ...defaults.visible, ...(s.visible && typeof s.visible === "object" ? s.visible : {}) },
    mode: s.mode === "frame" && !frameResult ? "solid" : s.mode === "frame" || s.mode === "solid" ? s.mode : defaults.mode,
    fontScale: typeof s.fontScale === "number" ? s.fontScale : defaults.fontScale,
    dimColor: typeof s.dimColor === "string" ? s.dimColor : defaults.dimColor,
    notes: bucketsOk(s.notes) ? s.notes! : defaults.notes,
    textBoxes: bucketsOk(s.textBoxes) ? s.textBoxes! : defaults.textBoxes,
    dimSettings: bucketsOk(s.dimSettings) ? s.dimSettings! : defaults.dimSettings,
    customDims: bucketsOk(s.customDims) ? s.customDims! : defaults.customDims,
    viewScale: bucketsOk(s.viewScale) ? s.viewScale! : defaults.viewScale,
    // Older saved sessions predate the adjustable Iso camera — fall back to the default.
    isoAngle:
      s.isoAngle && Number.isFinite(s.isoAngle.azimuthDeg) && Number.isFinite(s.isoAngle.elevationDeg)
        ? { azimuthDeg: s.isoAngle.azimuthDeg, elevationDeg: clampElevation(s.isoAngle.elevationDeg) }
        : defaults.isoAngle,
  };
}

export function DrawingSheetContent({
  drawing,
  productName,
  frameResult,
  handle,
  handleArcView,
  handlePaths,
  material,
  template,
  onOpenManager,
  templateOptions,
  activeTemplateId,
  onSelectTemplate,
  onClose,
  onCaptured,
  initialDoc,
  onDocChange,
}: DrawingSheetContentProps) {
  const [doc, setDoc] = useState<DocState>(() => buildInitialDoc(template, productName, frameResult, initialDoc));

  // Save every edit back onto the product (see initialDoc/onDocChange). The
  // first doc is skipped — merely opening the sheet must not write anything —
  // and the callback is read through a ref so an inline arrow from the
  // parent doesn't re-fire this on every parent render.
  const firstDocRef = useRef(doc);
  const onDocChangeRef = useRef(onDocChange);
  useEffect(() => {
    onDocChangeRef.current = onDocChange;
  });
  useEffect(() => {
    if (doc === firstDocRef.current) return;
    onDocChangeRef.current?.(doc);
  }, [doc]);

  // The ACTIVE template can change shape (fields/views added or removed)
  // while this exact sheet is open, via "Quản lý template" — sync doc.fields/
  // visible to match whenever that happens, WITHOUT going through
  // commit()/undo (a template edit is a structural change to the sheet's
  // own setup, not a content edit the user should be able to "undo" here).
  // Preserves any value the user already typed for a field that still
  // exists (matched by id); a genuine TEMPLATE SWITCH instead remounts this
  // whole component fresh (see the `key` on it in DrawingSheetA4 below).
  // Adjusted DURING RENDER (React's own sanctioned "derived state" pattern
  // — see the docs' "adjusting state when a prop changes" — not inside a
  // useEffect, which would cascade an extra render for the exact same
  // result), guarded by a signature snapshot so it only fires the one
  // render the template's fields/views actually changed on.
  const fieldsSignature = template.fields.map((f) => `${f.id}:${f.label}`).join("|");
  const viewsSignature = template.views.join(",");
  const [lastFieldsSignature, setLastFieldsSignature] = useState(fieldsSignature);
  const [lastViewsSignature, setLastViewsSignature] = useState(viewsSignature);
  if (fieldsSignature !== lastFieldsSignature || viewsSignature !== lastViewsSignature) {
    setLastFieldsSignature(fieldsSignature);
    setLastViewsSignature(viewsSignature);
    const byId = new Map(doc.fields.map((f) => [f.id, f]));
    const fields = template.fields.map((f) => {
      const existing = byId.get(f.id);
      return existing ? { ...existing, label: f.label } : { id: f.id, label: f.label, value: fieldValue(f, productName) };
    });
    const nextVisible = { ...doc.visible };
    for (const k of template.views) if (!(k in nextVisible)) nextVisible[k] = true;
    setDoc({ ...doc, fields, visible: nextVisible });
  }

  const { fields, visible, mode, fontScale, dimColor, notes, textBoxes, dimSettings, customDims, viewScale, isoAngle } = doc;
  const [history, setHistory] = useState<DocState[]>([]);
  const [future, setFuture] = useState<DocState[]>([]);
  // A ref here would trip the "no ref reads during render" lint rule the
  // moment `commit` (which reads it) gets handed to a child as a prop
  // callback (onNotesChange etc. below) — state instead: the extra
  // setLastCommitTime re-render this adds is free, since commit() already
  // triggers one via setDoc in the same batch.
  const [lastCommitTime, setLastCommitTime] = useState(0);

  const commit = useCallback(
    (next: DocState) => {
      const now = Date.now();
      if (now - lastCommitTime > UNDO_DEBOUNCE_MS) {
        setHistory((h) => [...h, doc].slice(-UNDO_STACK_LIMIT));
        setFuture([]);
      }
      setLastCommitTime(now);
      setDoc(next);
    },
    [doc, lastCommitTime],
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [doc, ...f].slice(0, UNDO_STACK_LIMIT));
    setLastCommitTime(0);
    setDoc(prev);
  }, [doc, history]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, doc].slice(-UNDO_STACK_LIMIT));
    setLastCommitTime(0);
    setDoc(next);
  }, [doc, future]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z — skipped while a text field (title
  // block, font size, a dim's double-click value override, …) is focused,
  // so the field's own native text-undo still works there instead of being
  // hijacked into undoing the whole sheet.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Click-to-select (see Selection above) + Delete/Backspace to remove
  // whatever's selected — replaces the old "click a dim's line = hide it
  // instantly" behaviour, which was too easy to trigger by accident.
  const [selected, setSelected] = useState<Selection | null>(null);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    const { view, kind, id } = selected;
    if (kind === "dim") {
      const current = doc.dimSettings[view][id] ?? {};
      commit({ ...doc, dimSettings: { ...doc.dimSettings, [view]: { ...doc.dimSettings[view], [id]: { ...current, hidden: true } } } });
    } else if (kind === "customDim") {
      commit({ ...doc, customDims: { ...doc.customDims, [view]: doc.customDims[view].filter((d) => d.id !== id) } });
    } else if (kind === "note") {
      commit({ ...doc, notes: { ...doc.notes, [view]: doc.notes[view].filter((n) => n.id !== id) } });
    } else {
      commit({ ...doc, textBoxes: { ...doc.textBoxes, [view]: doc.textBoxes[view].filter((b) => b.id !== id) } });
    }
    setSelected(null);
  }, [selected, doc, commit]);

  // null in a field explicitly clears that override, falling back to the
  // sheet-wide dimColor/fontScale again.
  function updateSelectedStyle(patch: { color?: string | null; fontSize?: number | null }) {
    if (!selected) return;
    const { view, kind, id } = selected;
    function applyPatch<T extends { color?: string; fontSize?: number }>(item: T): T {
      const next = { ...item };
      if ("color" in patch) {
        if (patch.color === null) delete next.color;
        else next.color = patch.color;
      }
      if ("fontSize" in patch) {
        if (patch.fontSize === null) delete next.fontSize;
        else next.fontSize = patch.fontSize;
      }
      return next;
    }
    if (kind === "dim") {
      commit({ ...doc, dimSettings: { ...doc.dimSettings, [view]: { ...doc.dimSettings[view], [id]: applyPatch(doc.dimSettings[view][id] ?? {}) } } });
    } else if (kind === "customDim") {
      commit({ ...doc, customDims: { ...doc.customDims, [view]: doc.customDims[view].map((d) => (d.id === id ? applyPatch(d) : d)) } });
    } else if (kind === "note") {
      commit({ ...doc, notes: { ...doc.notes, [view]: doc.notes[view].map((n) => (n.id === id ? applyPatch(n) : n)) } });
    } else {
      commit({ ...doc, textBoxes: { ...doc.textBoxes, [view]: doc.textBoxes[view].map((b) => (b.id === id ? applyPatch(b) : b)) } });
    }
  }

  function selectedStyle(): { color?: string; fontSize?: number } {
    if (!selected) return {};
    const { view, kind, id } = selected;
    if (kind === "dim") return doc.dimSettings[view][id] ?? {};
    if (kind === "customDim") return doc.customDims[view].find((d) => d.id === id) ?? {};
    if (kind === "note") return doc.notes[view].find((n) => n.id === id) ?? {};
    return doc.textBoxes[view].find((b) => b.id === id) ?? {};
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selected) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      deleteSelected();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, deleteSelected]);

  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(1100);
  const [noteMode, setNoteMode] = useState(false);
  const [textBoxMode, setTextBoxMode] = useState(false);
  const [dimPickMode, setDimPickMode] = useState<DimPickMode>(null);
  const [exporting, setExporting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "error">("idle");
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Partial<Record<DrawingViewKey, HTMLDivElement | null>>>({});
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Fires once — this component's `doc` is always fresh defaults on mount
  // (never persisted, see its useState initializer above), so "after the
  // first render" already IS "this product's default sheet, fully drawn" —
  // no further settling to wait for. Deliberately NOT re-run on every
  // doc/template change like a normal effect would: it's a one-shot "report
  // what mounted" signal, not a live subscription.
  useEffect(() => {
    if (!onCaptured) return;
    const views: PdfViewSpec[] = template.views.map((key) => ({
      key,
      label: DRAWING_VIEW_LABELS[key],
      visible: true,
      svgEl: cellRefs.current[key]?.querySelector("svg") ?? null,
    }));
    onCaptured({ views, fields: doc.fields.map((f) => ({ label: f.label, value: f.value })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customizedDimCount = Object.values(dimSettings).reduce((sum, map) => sum + Object.keys(map).length, 0);
  const customDimCount = Object.values(customDims).reduce((sum, list) => sum + list.length, 0);

  // Fit the sheet to whatever room the container actually has (at zoom=1)
  // so a fresh open never needs scrolling — width- or height-bound,
  // whichever the container is tighter on.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      const availW = el.clientWidth - SHEET_PADDING;
      const availH = el.clientHeight - SHEET_PADDING;
      setFitWidth(Math.max(400, Math.min(availW, availH * A4_RATIO)));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zooms toward the cursor (SketchUp/CAD convention — scroll alone
  // zooms, no modifier needed): the point under the pointer stays put while
  // everything scales around it, instead of the sheet growing from its
  // top-left corner and forcing a manual re-scroll every step. Needs a
  // native, non-passive listener — React's onWheel can't reliably
  // preventDefault the container's scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el) return;
      e.preventDefault();
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(oldZoom - e.deltaY * 0.0015).toFixed(2)));
      if (newZoom === oldZoom) return;
      const rect = el.getBoundingClientRect();
      const contentX = e.clientX - rect.left + el.scrollLeft;
      const contentY = e.clientY - rect.top + el.scrollTop;
      const ratio = newZoom / oldZoom;
      zoomRef.current = newZoom;
      setZoom(newZoom);
      requestAnimationFrame(() => {
        el.scrollLeft = contentX * ratio - (e.clientX - rect.left);
        el.scrollTop = contentY * ratio - (e.clientY - rect.top);
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function setField(id: string, value: string) {
    commit({ ...doc, fields: doc.fields.map((f) => (f.id === id ? { ...f, value } : f)) });
  }

  const { cols, rows } = computeGridLayout(template.views.length);
  const cellContentHeightMm = computeCellContentHeightMm(rows, template.showViewFrame);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const views = template.views.map((key) => ({
        key,
        label: DRAWING_VIEW_LABELS[key],
        visible: visible[key] ?? true,
        svgEl: cellRefs.current[key]?.querySelector("svg") ?? null,
      }));
      await exportDrawingSheetPdf({
        productName: fields.find((f) => f.label === "Tên bản vẽ")?.value || productName,
        companyName: template.companyName,
        logoDataUrl: template.logoDataUrl,
        titleBlockWidthMm: template.titleBlockWidthMm,
        fieldRowMinHeightMm: template.fieldRowMinHeightMm,
        fields: fields.map((f) => ({ label: f.label, value: f.value })),
        views,
        showViewFrame: template.showViewFrame,
      });
    } finally {
      setExporting(false);
    }
  }

  // Rasterizes the actual A4 sheet DOM node (views grid + title block, NOT
  // the sidebar) at a fixed 300 DPI regardless of the current on-screen
  // zoom — pixelRatio is derived from the node's live CSS width so "Xuất
  // ảnh"/"Copy ảnh" always produce the same print-quality resolution
  // whether the user is zoomed to 50% or 250%.
  const EXPORT_DPI = 300;
  async function captureSheetBlob(): Promise<Blob | null> {
    const node = sheetRef.current;
    if (!node) return null;
    const { toBlob } = await import("html-to-image");
    const targetWidthPx = Math.round((PAGE_W_MM / 25.4) * EXPORT_DPI);
    const pixelRatio = targetWidthPx / node.clientWidth;
    return toBlob(node, { pixelRatio, backgroundColor: "#ffffff", cacheBust: true });
  }

  async function handleExportImage() {
    setExporting(true);
    try {
      const blob = await captureSheetBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFileName(fields.find((f) => f.label === "Tên bản vẽ")?.value || productName)}-ban-ve.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyImage() {
    setExporting(true);
    try {
      const blob = await captureSheetBlob();
      if (!blob) {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 1500);
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopyStatus("done");
      } catch {
        setCopyStatus("error");
      }
      setTimeout(() => setCopyStatus("idle"), 1500);
    } finally {
      setExporting(false);
    }
  }

  const tubes = frameResult?.tubes;

  const viewProps = (drawingKey: DrawingViewKey) => {
    const key = DRAWING_VIEW_STATE_KEY[drawingKey];
    const vs = viewScale[key];
    // 1:x → half of the real mm span this scale gives THIS view on the
    // actual A4 page (see computeCellContentHeightMm's own comment for why
    // it's specifically the cell's HEIGHT that's the limiting dimension).
    const fixedHalfExtent = vs.denominator ? (cellContentHeightMm * vs.denominator) / 2 : undefined;
    return {
      drawing,
      mode,
      tubes: mode === "frame" ? tubes : undefined,
      frameColor: frameResult?.colorHex,
      fontScale,
      dimColor,
      notes: notes[key],
      onNotesChange: (next: Note[]) => commit({ ...doc, notes: { ...doc.notes, [key]: next } }),
      noteMode,
      textBoxes: textBoxes[key],
      onTextBoxesChange: (next: TextBoxItem[]) => commit({ ...doc, textBoxes: { ...doc.textBoxes, [key]: next } }),
      textBoxMode,
      onTextBoxPlaced: () => setTextBoxMode(false),
      dimSettings: dimSettings[key],
      onDimSettingsChange: (id: string, next: DimSettings) =>
        commit({ ...doc, dimSettings: { ...doc.dimSettings, [key]: { ...doc.dimSettings[key], [id]: next } } }),
      material,
      fixedHalfExtent,
      panX: vs.panX,
      panY: vs.panY,
      onPanChange: (panX: number, panY: number) => commit({ ...doc, viewScale: { ...doc.viewScale, [key]: { ...vs, panX, panY } } }),
      selectedDimId: selected?.view === key && selected.kind === "dim" ? selected.id : null,
      onSelectDim: (id: string) => setSelected({ view: key, kind: "dim", id }),
      selectedNoteId: selected?.view === key && selected.kind === "note" ? selected.id : null,
      onSelectNote: (id: string) => setSelected({ view: key, kind: "note", id }),
      selectedTextBoxId: selected?.view === key && selected.kind === "textbox" ? selected.id : null,
      onSelectTextBox: (id: string) => setSelected({ view: key, kind: "textbox", id }),
      onClearSelection: () => setSelected(null),
      // Iso is a projection (foreshortened) — SVG space there isn't real mm,
      // so it doesn't get the free-measure custom-dim tool.
      ...(drawingKey === "iso"
        ? {}
        : {
            customDims: customDims[key],
            onCustomDimsChange: (next: CustomDim[]) => commit({ ...doc, customDims: { ...doc.customDims, [key]: next } }),
            dimPickMode,
            selectedCustomDimId: selected?.view === key && selected.kind === "customDim" ? selected.id : null,
            onSelectCustomDim: (id: string) => setSelected({ view: key, kind: "customDim", id }),
          }),
    };
  };

  function renderView(key: DrawingViewKey) {
    const props = viewProps(key);
    switch (key) {
      case "front":
      case "back":
        return <FrontSideSVG {...props} view="front" handlePaths={handlePaths} handle={handle} handleArcView={handleArcView} />;
      case "left":
      case "right":
        return <FrontSideSVG {...props} view="side" handlePaths={handlePaths} handle={handle} handleArcView={handleArcView} />;
      case "top":
      case "bottom":
        return <TopSVG {...props} />;
      case "iso":
        return <IsoSVG {...props} handlePaths={handlePaths} isoAngle={isoAngle} />;
    }
  }

  // Same mm→px conversion the title-block column's own width already uses
  // (fitWidth*zoom is the sheet's on-screen WIDTH in px for the page's
  // 297mm) — the sheet's on-screen HEIGHT for the page's 210mm follows from
  // the fixed A4_RATIO, so a row's minimum height stays proportional to the
  // real mm value at any zoom level, same as pdfExport.ts prints it.
  const sheetHeightPx = (fitWidth * zoom) / A4_RATIO;
  const rowMinHeightPx = (template.fieldRowMinHeightMm / PAGE_H_MM) * sheetHeightPx;
  const pageMarginXPx = (PAGE_MARGIN_MM / PAGE_W_MM) * fitWidth * zoom;
  const pageMarginYPx = (PAGE_MARGIN_MM / PAGE_H_MM) * sheetHeightPx;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold text-text">Xuất bản vẽ — {productName}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {exporting ? "Đang xuất…" : "⬇ Xuất PDF"}
          </button>
          <button
            type="button"
            onClick={handleExportImage}
            disabled={exporting}
            title="Xuất ảnh (PNG, chất lượng cao)"
            className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-text-muted hover:text-text disabled:opacity-60"
          >
            ⬇ Xuất ảnh
          </button>
          <button
            type="button"
            onClick={handleCopyImage}
            disabled={exporting}
            title="Copy ảnh (PNG, chất lượng cao)"
            className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-text-muted hover:text-text disabled:opacity-60"
          >
            {copyStatus === "done" ? "✓ Đã copy" : copyStatus === "error" ? "Lỗi copy" : "⧉ Copy ảnh"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1.5 text-[13px] font-semibold text-text-muted hover:bg-bg hover:text-text"
          >
            Đóng
          </button>
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-1 gap-4">
      {/* Left panel — every sheet control lives here now, instead of a
          cramped toolbar strip above the sheet. */}
      <div className="flex w-[270px] flex-shrink-0 flex-col gap-5 overflow-y-auto rounded-lg border border-line bg-bg p-4">
        <ControlGroup title="Template">
          <select
            value={activeTemplateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
            className="h-9 rounded-md border border-line bg-white px-2.5 text-[12.5px] font-semibold text-text focus:border-accent focus:outline-none"
          >
            {templateOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenManager}
            className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-bg hover:text-text"
          >
            ⚙ Quản lý template
          </button>
        </ControlGroup>

        <ControlGroup title="Lịch sử">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              className="flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text disabled:opacity-30"
              title="Hoàn tác (Ctrl+Z)"
            >
              ↶ Hoàn tác
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              className="flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text disabled:opacity-30"
              title="Làm lại (Ctrl+Shift+Z)"
            >
              ↷ Làm lại
            </button>
          </div>
        </ControlGroup>

        {selected && (
          <ControlGroup title="Mục đang chọn">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-text">Màu riêng</span>
              <div className="flex items-center gap-1">
                {DIM_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => updateSelectedStyle({ color: preset.value })}
                    className={
                      (selectedStyle().color ?? "").toLowerCase() === preset.value
                        ? "h-5 w-5 rounded-full ring-2 ring-offset-1 ring-[var(--accent)]"
                        : "h-5 w-5 rounded-full border border-line"
                    }
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
                <input
                  type="color"
                  value={selectedStyle().color ?? dimColor}
                  onChange={(e) => updateSelectedStyle({ color: e.target.value })}
                  className="h-7 w-9 cursor-pointer rounded border border-line p-0"
                  title="Tùy chỉnh (RGB)"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-text">Cỡ chữ riêng</span>
              <input
                type="number"
                min={5}
                max={80}
                step={1}
                value={selectedStyle().fontSize ?? ""}
                placeholder="Mặc định"
                onChange={(e) => {
                  if (e.target.value === "") {
                    updateSelectedStyle({ fontSize: null });
                    return;
                  }
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v > 0) updateSelectedStyle({ fontSize: v });
                }}
                className="h-7 w-20 rounded border border-line px-1.5 text-[12px]"
              />
            </div>
            {(selectedStyle().color || selectedStyle().fontSize) && (
              <button
                type="button"
                onClick={() => updateSelectedStyle({ color: null, fontSize: null })}
                className="w-full rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-text-muted hover:text-text"
              >
                ↺ Dùng màu/cỡ chữ chung
              </button>
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={deleteSelected} className="flex-1 rounded-md bg-[#b3432f] px-2.5 py-1.5 text-[12px] font-bold text-white hover:opacity-90">
                Xóa (Delete)
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
              >
                Bỏ chọn
              </button>
            </div>
          </ControlGroup>
        )}

        <ControlGroup title="Nguồn hình">
          <div className="flex items-center gap-1 rounded-md border border-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => commit({ ...doc, mode: "frame" })}
              disabled={!frameResult}
              title={frameResult ? undefined : "Chưa có khung sắt"}
              className={
                mode === "frame"
                  ? "flex-1 rounded bg-accent px-2.5 py-1.5 text-[12px] font-bold text-white"
                  : "flex-1 rounded px-2.5 py-1.5 text-[12px] font-semibold text-text-muted disabled:opacity-40"
              }
            >
              Khung sắt
            </button>
            <button
              type="button"
              onClick={() => commit({ ...doc, mode: "solid" })}
              className={mode === "solid" ? "flex-1 rounded bg-accent px-2.5 py-1.5 text-[12px] font-bold text-white" : "flex-1 rounded px-2.5 py-1.5 text-[12px] font-semibold text-text-muted"}
            >
              Solid
            </button>
          </div>
        </ControlGroup>

        <DropdownGroup
          title="Hiện view"
          summary={<span>{Object.values(visible).filter((v) => v !== false).length}/{template.views.length} view đang hiện</span>}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {template.views.map((k) => (
              <label key={k} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
                <input
                  type="checkbox"
                  checked={visible[k] ?? true}
                  onChange={(e) => commit({ ...doc, visible: { ...doc.visible, [k]: e.target.checked } })}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                {DRAWING_VIEW_LABELS[k]}
              </label>
            ))}
          </div>
        </DropdownGroup>

        <DropdownGroup
          title="Chữ & màu"
          summary={
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-line" style={{ backgroundColor: dimColor }} />
              Cỡ {fontScale}x
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-text">Cỡ chữ</span>
              <input
                type="number"
                min={FONT_SCALE_MIN}
                max={FONT_SCALE_MAX}
                step={0.1}
                value={fontScale}
                onChange={(e) => commit({ ...doc, fontScale: Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(e.target.value) || 1.8)) })}
                className="h-7 w-16 rounded border border-line px-1.5 text-[12px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-text">Màu chữ</span>
              <div className="flex items-center gap-1">
                {DIM_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => commit({ ...doc, dimColor: preset.value })}
                    className={
                      dimColor.toLowerCase() === preset.value
                        ? "h-5 w-5 rounded-full ring-2 ring-offset-1 ring-[var(--accent)]"
                        : "h-5 w-5 rounded-full border border-line"
                    }
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
                <input
                  type="color"
                  value={dimColor}
                  onChange={(e) => commit({ ...doc, dimColor: e.target.value })}
                  className="h-7 w-9 cursor-pointer rounded border border-line p-0"
                  title="Tùy chỉnh (RGB)"
                />
              </div>
            </div>
          </div>
        </DropdownGroup>

        <DropdownGroup
          title="Tỷ lệ hiển thị"
          summary={
            <span>
              {(["front", "side", "top", "iso"] as ViewKey[]).filter((k) => viewScale[k].denominator !== null).length === 0
                ? "Tất cả: Tự động"
                : `${(["front", "side", "top", "iso"] as ViewKey[]).filter((k) => viewScale[k].denominator !== null).length} hình đã chỉnh tỷ lệ`}
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-1.5">
            {(["front", "side", "top", "iso"] as ViewKey[]).map((k) => {
              const vs = viewScale[k];
              const setVs = (next: ViewScaleState) => commit({ ...doc, viewScale: { ...doc.viewScale, [k]: next } });
              const hasPan = vs.panX !== 0 || vs.panY !== 0;
              const label = k === "front" ? "Front" : k === "side" ? "Side" : k === "top" ? "Top" : "Iso";
              return (
                <div key={k} className="flex flex-col gap-1 rounded-md border border-line bg-bg p-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text">{label}</span>
                    {hasPan && (
                      <button
                        type="button"
                        onClick={() => setVs({ ...vs, panX: 0, panY: 0 })}
                        title="Đưa về vị trí gốc"
                        className="text-[10px] font-semibold text-accent hover:underline"
                      >
                        ⟲
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded border border-line bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setVs({ ...vs, denominator: null })}
                      className={
                        vs.denominator === null
                          ? "flex-1 rounded bg-accent px-1 py-1 text-[10.5px] font-bold text-white"
                          : "flex-1 rounded px-1 py-1 text-[10.5px] font-semibold text-text-muted"
                      }
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setVs({ ...vs, denominator: vs.denominator ?? DEFAULT_DENOMINATOR[k] })}
                      className={
                        vs.denominator !== null
                          ? "flex-1 rounded bg-accent px-1 py-1 text-[10.5px] font-bold text-white"
                          : "flex-1 rounded px-1 py-1 text-[10.5px] font-semibold text-text-muted"
                      }
                    >
                      1:x
                    </button>
                  </div>
                  {vs.denominator !== null && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={vs.denominator}
                      onChange={(e) => setVs({ ...vs, denominator: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                      className="h-6 w-full rounded border border-line px-1 text-[10.5px]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </DropdownGroup>

        {template.views.includes("iso") && (
          <DropdownGroup
            title="Góc nhìn Iso"
            summary={
              <span>
                Xoay {isoAngle.azimuthDeg}° · Nghiêng {isoAngle.elevationDeg}°
              </span>
            }
          >
            {(() => {
              const setAngle = (next: Partial<IsoAngle>) => commit({ ...doc, isoAngle: { ...doc.isoAngle, ...next } });
              const isDefault = isoAngle.azimuthDeg === DEFAULT_ISO_ANGLE.azimuthDeg && isoAngle.elevationDeg === DEFAULT_ISO_ANGLE.elevationDeg;
              const stepBtn = "h-7 w-8 rounded border border-line bg-white text-[13px] font-bold text-text-muted hover:bg-bg hover:text-text";
              return (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text">Xoay trái / phải</span>
                    <div className="flex items-center gap-1">
                      <button type="button" title="Xoay trái 15°" onClick={() => setAngle({ azimuthDeg: wrapAzimuth(isoAngle.azimuthDeg + 15) })} className={stepBtn}>
                        ◀
                      </button>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={isoAngle.azimuthDeg}
                        onChange={(e) => setAngle({ azimuthDeg: wrapAzimuth(Number(e.target.value)) })}
                        className="min-w-0 flex-1"
                      />
                      <button type="button" title="Xoay phải 15°" onClick={() => setAngle({ azimuthDeg: wrapAzimuth(isoAngle.azimuthDeg - 15) })} className={stepBtn}>
                        ▶
                      </button>
                      <input
                        type="number"
                        min={-180}
                        max={180}
                        value={isoAngle.azimuthDeg}
                        onChange={(e) => setAngle({ azimuthDeg: wrapAzimuth(Math.round(Number(e.target.value) || 0)) })}
                        className="h-7 w-14 rounded border border-line px-1 text-[11px]"
                      />
                      <span className="text-[11px] text-text-faint">°</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text">Nghiêng lên / xuống</span>
                    <div className="flex items-center gap-1">
                      <button type="button" title="Hạ góc nhìn xuống 5° (nhìn ngang hơn)" onClick={() => setAngle({ elevationDeg: clampElevation(isoAngle.elevationDeg - 5) })} className={stepBtn}>
                        ▼
                      </button>
                      <input
                        type="range"
                        min={ISO_ELEVATION_RANGE.min}
                        max={ISO_ELEVATION_RANGE.max}
                        step={1}
                        value={isoAngle.elevationDeg}
                        onChange={(e) => setAngle({ elevationDeg: clampElevation(Number(e.target.value)) })}
                        className="min-w-0 flex-1"
                      />
                      <button type="button" title="Nâng góc nhìn lên 5° (nhìn từ trên xuống nhiều hơn)" onClick={() => setAngle({ elevationDeg: clampElevation(isoAngle.elevationDeg + 5) })} className={stepBtn}>
                        ▲
                      </button>
                      <input
                        type="number"
                        min={ISO_ELEVATION_RANGE.min}
                        max={ISO_ELEVATION_RANGE.max}
                        value={isoAngle.elevationDeg}
                        onChange={(e) => setAngle({ elevationDeg: clampElevation(Math.round(Number(e.target.value) || ISO_ELEVATION_RANGE.min)) })}
                        className="h-7 w-14 rounded border border-line px-1 text-[11px]"
                      />
                      <span className="text-[11px] text-text-faint">°</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isDefault}
                    onClick={() => setAngle({ ...DEFAULT_ISO_ANGLE })}
                    className="self-start rounded border border-line bg-white px-2 py-1 text-[11px] font-semibold text-text-muted hover:text-text disabled:opacity-50"
                  >
                    ⟲ Về mặc định ({DEFAULT_ISO_ANGLE.azimuthDeg}° / {DEFAULT_ISO_ANGLE.elevationDeg}°)
                  </button>
                </div>
              );
            })()}
          </DropdownGroup>
        )}

        <ControlGroup title="Phóng to trang">
          <div className="flex items-center gap-1 rounded-md border border-line bg-white p-0.5">
            <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.15).toFixed(2)))} className="h-7 w-8 rounded text-[14px] font-bold text-text-muted hover:bg-bg">
              −
            </button>
            <button type="button" onClick={() => setZoom(1)} className="flex-1 text-center text-[12px] font-semibold text-text-muted hover:text-text">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.15).toFixed(2)))} className="h-7 w-8 rounded text-[14px] font-bold text-text-muted hover:bg-bg">
              +
            </button>
          </div>
        </ControlGroup>

        <ControlGroup title="Ghi chú">
          <button
            type="button"
            onClick={() =>
              setNoteMode((v) => {
                if (!v) {
                  setDimPickMode(null);
                  setTextBoxMode(false);
                }
                return !v;
              })
            }
            className={
              noteMode
                ? "w-full rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-bold text-white"
                : "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
            }
          >
            ✎ Thêm ghi chú
          </button>
          <button
            type="button"
            onClick={() =>
              setTextBoxMode((v) => {
                if (!v) {
                  setDimPickMode(null);
                  setNoteMode(false);
                }
                return !v;
              })
            }
            className={
              textBoxMode
                ? "w-full rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-bold text-white"
                : "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
            }
          >
            ▭ Chèn text box
          </button>
        </ControlGroup>

        {customizedDimCount > 0 && (
          <ControlGroup title="Kích thước (dim)">
            <button
              type="button"
              onClick={() => commit({ ...doc, dimSettings: { front: {}, side: {}, top: {}, iso: {} } })}
              className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
            >
              Đặt lại {customizedDimCount} dim đã chỉnh
            </button>
          </ControlGroup>
        )}

        <ControlGroup title="Tự đo dim khác">
          <div className="flex items-center gap-1 rounded-md border border-line bg-white p-0.5">
            {(
              [
                ["h", "Ngang"],
                ["v", "Dọc"],
                ["d", "Chéo"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  setDimPickMode((v) => {
                    const next = v === kind ? null : kind;
                    if (next) {
                      setNoteMode(false);
                      setTextBoxMode(false);
                    }
                    return next;
                  })
                }
                className={
                  dimPickMode === kind
                    ? "flex-1 rounded bg-accent px-2 py-1.5 text-[12px] font-bold text-white"
                    : "flex-1 rounded px-2 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-bg"
                }
              >
                {label}
              </button>
            ))}
          </div>
          {customDimCount > 0 && (
            <button
              type="button"
              onClick={() => commit({ ...doc, customDims: { front: [], side: [], top: [], iso: [] } })}
              className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
            >
              Xóa {customDimCount} dim tự đo
            </button>
          )}
        </ControlGroup>

        <div className="mt-auto text-[11px] text-text-faint">Khổ A4 ngang (297×210mm)</div>
      </div>

      {/* A4 landscape sheet (297×210mm) — scrolls/zooms in place */}
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto rounded-lg border border-line bg-bg p-4">
        <div
          ref={sheetRef}
          className="relative overflow-hidden rounded-lg bg-white shadow-sm"
          style={{ width: fitWidth * zoom, aspectRatio: "297 / 210", flexShrink: 0 }}
        >
          {/* The drafting frame — inset PAGE_MARGIN_MM (1cm) from the
              physical paper edge on every side (ISO 5457), rather than
              running flush to it. `inset` with no explicit width/height
              lets CSS compute both dimensions to exactly fill that margin,
              instead of hand-computing a reduced width/height that would
              also need to agree with the margin on every resize/zoom. */}
          <div
            className="absolute flex border-2 border-black"
            style={{ top: pageMarginYPx, bottom: pageMarginYPx, left: pageMarginXPx, right: pageMarginXPx }}
          >
            <div
              className="grid min-w-0 flex-1 gap-2 p-3"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {template.views.map((key) => (
                <ViewCell
                  key={key}
                  label={DRAWING_VIEW_LABELS[key]}
                  visible={visible[key] ?? true}
                  showFrame={template.showViewFrame}
                  contentRef={(el) => (cellRefs.current[key] = el)}
                >
                  {renderView(key)}
                </ViewCell>
              ))}
            </div>

            <div className="flex flex-shrink-0 flex-col border-l-2 border-black" style={{ width: (template.titleBlockWidthMm / PAGE_W_MM) * fitWidth * zoom }}>
              <div className="flex h-16 flex-shrink-0 items-center justify-center border-b border-black px-2">
                {template.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={template.logoDataUrl} alt={template.companyName} className="max-h-12 max-w-[90%] object-contain" />
                ) : (
                  <span className="text-[13px] font-bold text-black">{template.companyName || "—"}</span>
                )}
              </div>
              {/* flex-1 + minHeight (not just natural content height) so a
                  short field list stretches to fill the rest of the sheet's
                  height instead of leaving the bottom of the title block
                  empty — minHeight is template.fieldRowMinHeightMm so a row
                  never shrinks below the user's own chosen height even with
                  many fields. The label/value split inside each row uses
                  the SAME flex-grow weights pdfExport.ts splits its own
                  rowH by, so BOTH the gray label strip and the white value
                  strip grow together when the row stretches — not just the
                  value, which is what made the label look "stuck" before. */}
              {fields.map((f) => (
                <div key={f.id} className="flex flex-1 flex-col border-b border-black" style={{ minHeight: rowMinHeightPx }}>
                  <div
                    className="flex flex-shrink-0 items-center border-b border-black bg-bg px-2 py-1 text-[9.5px] font-bold tracking-wide text-black uppercase"
                    style={{ flexGrow: ROW_LABEL_WEIGHT, flexBasis: 0 }}
                  >
                    {f.label}
                  </div>
                  <input
                    value={f.value}
                    onChange={(e) => setField(f.id, e.target.value)}
                    style={{ flexGrow: ROW_VALUE_WEIGHT, flexBasis: 0 }}
                    className="bg-white px-2 py-1 text-[11.5px] text-black outline-none focus:bg-accent-soft"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export function DrawingSheetA4({
  drawing,
  productName,
  frameResult,
  handle,
  handleArcView = "side",
  handlePaths,
  material,
  onClose,
  initialDoc,
  onDocChange,
  lidSheet,
}: {
  initialDoc?: unknown;
  onDocChange?: (doc: DocState) => void;
  // Present only for a product with a lid: the lid's own drawing, which becomes a
  // second sheet ("Nắp") next to the body's ("Thân"), each with its own saved doc.
  lidSheet?: {
    drawing: ShapeDrawingInput;
    frameResult: SteelFrameResult | null;
    material: MaterialInput;
    initialDoc?: unknown;
    onDocChange?: (doc: DocState) => void;
  };
  drawing: ShapeDrawingInput;
  productName: string;
  frameResult: SteelFrameResult | null;
  handle: HandleInput;
  // Which view shows the standing handle's true arc — "side" for every
  // shape except a Rectangle handle mounted on the width axis (see
  // TechnicalDrawing.tsx's own ElevationProps comment).
  handleArcView?: "front" | "side";
  handlePaths: Point3[][];
  material: MaterialInput;
  onClose: () => void;
}) {
  const { role } = useRole();
  const canManage = canManageDrawingTemplates(role);
  const [templates, setTemplates] = useState<DrawingTemplate[] | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  // Thân | Nắp (only when the product has a lid). The latest doc of each sheet
  // lives in a ref so switching tabs (which remounts the sheet) and the combined
  // PDF export always see the newest edits, not what the parent last re-rendered with.
  const [part, setPart] = useState<SheetPart>("body");
  const docsRef = useRef<Record<SheetPart, unknown>>({ body: initialDoc, lid: lidSheet?.initialDoc });
  const [bothExporting, setBothExporting] = useState(false);
  const [captureParts, setCaptureParts] = useState<SheetPart[] | null>(null);
  const capturedRef = useRef<Map<SheetPart, { views: PdfViewSpec[]; fields: PdfTitleField[] }>>(new Map());
  const captureWaitRef = useRef<(() => void) | null>(null);
  // Debounced per-template-id, same 400ms cadence the breakdown product
  // autosave uses — editing a template field fires on every keystroke
  // (TemplateManager has no debounce of its own), so without this each
  // keystroke would PATCH immediately instead of coalescing into one write
  // once typing pauses.
  const updateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatches = useRef<Record<string, Partial<DrawingTemplate>>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDrawingTemplates(), loadActiveTemplateId()]).then(([list, savedActiveId]) => {
      if (cancelled) return;
      setTemplates(list);
      setActiveTemplateId(savedActiveId && list.some((t) => t.id === savedActiveId) ? savedActiveId : list[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTemplate(id: string) {
    setActiveTemplateId(id);
    saveActiveTemplateId(id);
  }

  // Admin-only mutations — TemplateManager itself hides the controls that
  // call these for anyone else, this is just the belt (server-side
  // canManageDrawingTemplates is the actual suspenders).
  async function createTemplate(template: DrawingTemplate) {
    const created = await createDrawingTemplateRemote(template);
    if (!created) return;
    setTemplates((prev) => [...(prev ?? []), created]);
    selectTemplate(created.id);
  }

  function updateTemplate(id: string, patch: Partial<DrawingTemplate>) {
    setTemplates((prev) => (prev ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)));
    pendingPatches.current[id] = { ...pendingPatches.current[id], ...patch };
    clearTimeout(updateTimers.current[id]);
    updateTimers.current[id] = setTimeout(() => {
      const toSend = pendingPatches.current[id];
      delete pendingPatches.current[id];
      if (toSend) updateDrawingTemplateRemote(id, toSend);
    }, 400);
  }

  async function deleteTemplate(id: string) {
    const ok = await deleteDrawingTemplateRemote(id);
    if (!ok) return;
    setTemplates((prev) => {
      const next = (prev ?? []).filter((t) => t.id !== id);
      if (activeTemplateId === id && next.length) selectTemplate(next[0].id);
      return next;
    });
  }

  if (!templates || activeTemplateId === null) {
    return <div className="flex h-full items-center justify-center text-[13px] text-text-faint">Đang tải template…</div>;
  }

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? templates[0];
  const hasLid = !!lidSheet;
  const shownPart: SheetPart = hasLid ? part : "body";

  // Everything one sheet needs, for the visible tab and the off-screen export copies alike.
  const sheetProps = (p: SheetPart) => {
    const isLid = p === "lid" && !!lidSheet;
    const name = hasLid ? `${productName} — ${SHEET_PART_LABEL[p]}` : productName;
    return {
      drawing: isLid ? lidSheet!.drawing : drawing,
      productName: name,
      frameResult: isLid ? lidSheet!.frameResult : frameResult,
      handle,
      handleArcView: isLid ? ("side" as const) : handleArcView,
      handlePaths: isLid ? [] : handlePaths,
      material: isLid ? lidSheet!.material : material,
      template: activeTemplate,
      initialDoc: hasLid ? withPartName(docsRef.current[p], productName, name) : docsRef.current[p],
    };
  };
  const saveDoc = (p: SheetPart) => (doc: DocState) => {
    docsRef.current[p] = doc;
    (p === "lid" ? lidSheet?.onDocChange : onDocChange)?.(doc);
  };

  // One PDF with both sheets (Thân, then Nắp). The sheets that aren't on screen
  // are mounted off-screen just long enough to draw their SVGs and report back
  // (same approach as MultiDrawingExport) — the on-screen one is re-captured too
  // so all pages come from the same latest docs.
  async function exportBothPdf() {
    setBothExporting(true);
    capturedRef.current = new Map();
    setCaptureParts(["body", "lid"]);
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          captureWaitRef.current = resolve;
        }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
      const pdf = await createA4Pdf();
      let first = true;
      for (const p of ["body", "lid"] as SheetPart[]) {
        const cap = capturedRef.current.get(p);
        if (!cap) continue;
        if (!first) pdf.addPage();
        first = false;
        await addDrawingSheetPage(pdf, {
          companyName: activeTemplate.companyName,
          logoDataUrl: activeTemplate.logoDataUrl,
          titleBlockWidthMm: activeTemplate.titleBlockWidthMm,
          fieldRowMinHeightMm: activeTemplate.fieldRowMinHeightMm,
          fields: cap.fields,
          views: cap.views,
          showViewFrame: activeTemplate.showViewFrame,
        });
      }
      pdf.save(`${sanitizeFileName(productName)}-ban-ve-than-nap.pdf`);
    } catch {
      // The per-tab "Xuất PDF" still works; nothing more useful to surface here.
    } finally {
      setBothExporting(false);
      setCaptureParts(null);
    }
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-2">
        {hasLid && (
          <div className="flex flex-shrink-0 items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-line bg-bg p-1">
              {(["body", "lid"] as SheetPart[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPart(p)}
                  className={
                    shownPart === p
                      ? "rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-bold text-white"
                      : "rounded-md px-4 py-1.5 text-[12.5px] font-semibold text-text-muted hover:bg-surface hover:text-text"
                  }
                >
                  Bản vẽ {SHEET_PART_LABEL[p]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportBothPdf}
              disabled={bothExporting}
              title="Xuất 1 file PDF 2 trang: Thân rồi Nắp"
              className="h-8 rounded-md border border-line bg-white px-3 text-[12.5px] font-bold text-text hover:bg-bg disabled:opacity-60"
            >
              {bothExporting ? "Đang xuất…" : "⬇ Xuất PDF Thân + Nắp"}
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <DrawingSheetContent
            key={`${activeTemplate.id}:${shownPart}`}
            {...sheetProps(shownPart)}
            onOpenManager={() => setManagerOpen(true)}
            templateOptions={templates.map((t) => ({ id: t.id, name: t.name }))}
            activeTemplateId={activeTemplate.id}
            onSelectTemplate={selectTemplate}
            onClose={onClose}
            onDocChange={saveDoc(shownPart)}
          />
        </div>
      </div>
      {captureParts && (
        <div style={{ position: "fixed", left: -99999, top: 0, width: 1200 }} aria-hidden>
          {captureParts.map((p) => (
            <div key={p} style={{ width: 1200, height: 800 }}>
              <DrawingSheetContent
                {...sheetProps(p)}
                onOpenManager={() => {}}
                templateOptions={[{ id: activeTemplate.id, name: activeTemplate.name }]}
                activeTemplateId={activeTemplate.id}
                onSelectTemplate={() => {}}
                onClose={() => {}}
                onCaptured={(capture) => {
                  capturedRef.current.set(p, capture);
                  if (capturedRef.current.size >= captureParts.length) captureWaitRef.current?.();
                }}
              />
            </div>
          ))}
        </div>
      )}
      {managerOpen && (
        <TemplateManager
          templates={templates}
          activeTemplateId={activeTemplate.id}
          canManage={canManage}
          onSelectTemplate={selectTemplate}
          onCreateTemplate={createTemplate}
          onUpdateTemplate={updateTemplate}
          onDeleteTemplate={deleteTemplate}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </>
  );
}
