"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_PHOTO_TRACE, type PhotoTraceInput, type RingInput } from "@/lib/breakdown/geometry/types";
import { PhotoTraceForm } from "./PhotoTraceForm";

// Internal drawing resolution (fixed — this is the coordinate space every
// shape-building function below operates in). Zoom scales how it's
// DISPLAYED, not this. Big enough that a hand-drawn silhouette has real
// precision instead of being cramped into the narrow sidebar column
// PhotoTraceForm's own canvas lives in.
const CANVAS_W = 760;
const CANVAS_H = 900;
const DISPLAY_MAX_W = 780;
const DISPLAY_MAX_H = 560;
const GRID_STEP = 20;
const CURVE_SEGMENTS = 48;
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.5;
const WHEEL_ZOOM_FACTOR = 0.0015;
// A drag shorter than this (in canvas px) is almost certainly an accidental
// click, not an intended object — committing it produced exactly the "just a
// tiny dot" artifact from before.
const MIN_DRAG = 6;
const MIN_OBJECT_SIZE = 10;
const HANDLE_HIT_RADIUS = 14;
const HANDLE_DISPLAY_RADIUS = 6;
const ROTATE_HANDLE_OFFSET = 1.3; // in the object's own local -1..1 space, above the top edge
const HIT_STROKE_RADIUS = 12;

const WIDTHS = [
  { key: "thin", label: "Mỏng", px: 2 },
  { key: "medium", label: "Vừa", px: 4 },
  { key: "thick", label: "Đậm", px: 7 },
] as const;
const MIN_SIDES = 3;
const MAX_SIDES = 12;
const DEFAULT_SIDES = 6;
const DEFAULT_STAR_POINTS = 5;
const DEFAULT_INNER_DEPTH = 45; // %, Canva calls this "Inner depth"
const MAX_CORNER_RADIUS = 80;

const SHAPE_OPTIONS = [
  { key: "rect", label: "▭ Chữ nhật" },
  { key: "ellipse", label: "◯ Tròn / Oval" },
  { key: "polygon", label: "⬡ Đa giác (tam giác → nhiều cạnh)" },
  { key: "star", label: "★ Ngôi sao" },
] as const;
const SHAPE_TOOLS: Set<Tool> = new Set(SHAPE_OPTIONS.map((o) => o.key));
// Corner rounding only makes sense for shapes with actual straight corners.
const ROUNDABLE_KINDS: Set<ObjectKind> = new Set(["rect", "polygon", "star"]);

type Tool = "select" | "pen" | "line" | "arc" | "rect" | "ellipse" | "polygon" | "star" | "eraser";
type ObjectKind = "pen" | "line" | "arc" | "rect" | "ellipse" | "polygon" | "star";
type Point = { x: number; y: number };

// Every drawn thing is a persistent OBJECT, not a frozen stroke: local
// points live in a normalized -1..1 space, and cx/cy/w/h/rotation are the
// transform applied at render (and hit-test) time. That split is what makes
// an object movable/resizable/rotatable AFTER the fact, and — for the
// parametric shapes — re-editable (changing "sides" just regenerates
// localPoints; the transform and everything else stays put).
interface DrawObject {
  id: string;
  kind: ObjectKind;
  localPoints: Point[];
  closed: boolean;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number; // radians
  strokeWidth: number;
  cornerRadius: number; // world px, only meaningful for ROUNDABLE_KINDS
  sides: number; // polygon only
  starPointCount: number; // star only
  innerDepth: number; // star only, %
}

let objectIdSeq = 0;
function nextObjectId() {
  objectIdSeq += 1;
  return `obj${objectIdSeq}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function pointsNear(points: Point[], p: Point, radius: number): boolean {
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y) <= radius;
  for (let i = 0; i < points.length - 1; i++) {
    if (distToSegment(p, points[i], points[i + 1]) <= radius) return true;
  }
  return false;
}

// Standard ray-casting point-in-polygon test, used so clicking ANYWHERE
// inside a closed shape selects it (not just near its outline).
function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// ---- Unit-space shape generators (centered at origin, spanning -1..1) ----

function unitRect(): Point[] {
  return [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];
}

function unitEllipse(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const t = (i / CURVE_SEGMENTS) * Math.PI * 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t) });
  }
  return pts;
}

// A regular N-sided polygon IS a triangle at sides=3, a diamond at 4, a
// pentagon at 5, a hexagon at 6, etc — one shape generator, "Sides" is the
// only thing that changes, matching how Canva's own polygon tool works (no
// separate triangle/pentagon/hexagon tools).
function unitPolygon(sides: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= sides; i++) {
    const t = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t) });
  }
  return pts;
}

function unitStar(points: number, innerDepthPct: number): Point[] {
  const innerRatio = clamp(innerDepthPct, 5, 95) / 100;
  const pts: Point[] = [];
  const n = points * 2;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : innerRatio;
    pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
  }
  return pts;
}

function generateLocalPoints(kind: ObjectKind, sides: number, starPointCount: number, innerDepth: number): Point[] {
  if (kind === "rect") return unitRect();
  if (kind === "ellipse") return unitEllipse();
  if (kind === "polygon") return unitPolygon(sides);
  if (kind === "star") return unitStar(starPointCount, innerDepth);
  return []; // pen/line/arc keep their own traced localPoints, never regenerated
}

// Quadratic bezier from start to end curving through control — used both by
// the arc tool (control derives from how far the cursor strays from the
// chord) and by corner rounding below (control = the original sharp vertex).
function quadraticBezier(start: Point, control: Point, end: Point, segments: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
      y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
    });
  }
  return pts;
}

function arcLocalPoints(start: Point, end: Point, cursor: Point): Point[] {
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const offset = (cursor.x - mx) * nx + (cursor.y - my) * ny;
  // *2 so the curve's own peak (a quadratic bezier sits at half its control
  // point's offset from the chord) tracks the cursor directly, not at half distance.
  const control = { x: mx + nx * offset * 2, y: my + ny * offset * 2 };
  return quadraticBezier(start, control, end, CURVE_SEGMENTS);
}

// Rounds every corner of a CLOSED polygon path (first point === last point)
// by cutting each vertex back along both adjacent edges and bridging the gap
// with a quadratic curve tangent to both edges (control = the original sharp
// vertex) — the standard "cut and bulge" construction, works for any convex
// or star-shaped polygon the same way.
function roundCorners(points: Point[], radius: number): Point[] {
  if (radius <= 0 || points.length < 4) return points;
  const verts = points.slice(0, -1);
  const n = verts.length;
  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const curr = verts[i];
    const next = verts[(i + 1) % n];
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y) || 1;
    const lenNext = Math.hypot(toNext.x, toNext.y) || 1;
    const d = Math.min(radius, lenPrev / 2, lenNext / 2);
    const p1 = { x: curr.x + (toPrev.x / lenPrev) * d, y: curr.y + (toPrev.y / lenPrev) * d };
    const p2 = { x: curr.x + (toNext.x / lenNext) * d, y: curr.y + (toNext.y / lenNext) * d };
    result.push(p1, ...quadraticBezier(p1, curr, p2, 8).slice(1));
  }
  result.push(result[0]);
  return result;
}

// ---- Transform helpers (local -1..1 space <-> world canvas space) ----

function rotateVec(v: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function localToWorld(local: Point, obj: Pick<DrawObject, "cx" | "cy" | "w" | "h" | "rotation">): Point {
  const scaled = { x: (local.x * obj.w) / 2, y: (local.y * obj.h) / 2 };
  const rotated = rotateVec(scaled, obj.rotation);
  return { x: obj.cx + rotated.x, y: obj.cy + rotated.y };
}

function getWorldPoints(obj: DrawObject): Point[] {
  const pts = obj.localPoints.map((p) => localToWorld(p, obj));
  return obj.closed && ROUNDABLE_KINDS.has(obj.kind) ? roundCorners(pts, obj.cornerRadius) : pts;
}

// Builds a fresh object from a raw world-space drag's bounding box — shapes
// get their canonical unit-space generator; pen/line/arc normalize their own
// traced points into the same -1..1 local space so identity transform
// reconstructs exactly what was drawn.
function buildObject(
  kind: ObjectKind,
  rawWorldPoints: Point[],
  opts: { strokeWidth: number; cornerRadius: number; sides: number; starPointCount: number; innerDepth: number },
): DrawObject {
  const closed = kind === "rect" || kind === "ellipse" || kind === "polygon" || kind === "star";
  if (closed) {
    const xs = rawWorldPoints.map((p) => p.x);
    const ys = rawWorldPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      id: nextObjectId(),
      kind,
      localPoints: generateLocalPoints(kind, opts.sides, opts.starPointCount, opts.innerDepth),
      closed: true,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: Math.max(maxX - minX, MIN_OBJECT_SIZE),
      h: Math.max(maxY - minY, MIN_OBJECT_SIZE),
      rotation: 0,
      strokeWidth: opts.strokeWidth,
      cornerRadius: opts.cornerRadius,
      sides: opts.sides,
      starPointCount: opts.starPointCount,
      innerDepth: opts.innerDepth,
    };
  }
  const xs = rawWorldPoints.map((p) => p.x);
  const ys = rawWorldPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, MIN_OBJECT_SIZE);
  const h = Math.max(maxY - minY, MIN_OBJECT_SIZE);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    id: nextObjectId(),
    kind,
    localPoints: rawWorldPoints.map((p) => ({ x: (p.x - cx) / (w / 2), y: (p.y - cy) / (h / 2) })),
    closed: false,
    cx,
    cy,
    w,
    h,
    rotation: 0,
    strokeWidth: opts.strokeWidth,
    cornerRadius: 0,
    sides: opts.sides,
    starPointCount: opts.starPointCount,
    innerDepth: opts.innerDepth,
  };
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 flex-shrink-0 text-[11.5px] font-semibold text-text-muted">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 flex-1 accent-accent" />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Math.round(Number(e.target.value)) || min, min, max))}
        className="h-7 w-14 flex-shrink-0 rounded-md border border-line bg-surface px-1.5 text-center text-[12px]"
      />
    </div>
  );
}

type DragMode =
  | { type: "draw" }
  | { type: "move"; id: string; startMouse: Point; startCx: number; startCy: number }
  | { type: "resize"; id: string; sx: -1 | 0 | 1; sy: -1 | 0 | 1 }
  | { type: "rotate"; id: string };

const RESIZE_HANDLES: { sx: -1 | 0 | 1; sy: -1 | 0 | 1 }[] = [
  { sx: -1, sy: -1 },
  { sx: 0, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: 1, sy: 0 },
  { sx: 1, sy: 1 },
  { sx: 0, sy: 1 },
  { sx: -1, sy: 1 },
  { sx: -1, sy: 0 },
];

// The drawing canvas: every placed object (pen/line/arc/rect/ellipse/
// polygon/star) stays a live, selectable thing afterwards — click it (in
// "Chọn" mode) to get resize handles (8, corner+edge), a rotate handle, drag
// its body to move it, and — for the parametric shapes — a property panel
// (corner rounding / sides / points / inner depth) that reshapes it live,
// exactly like Canva's own shape objects. Once happy with the silhouette,
// "Xong, dò biên dạng" snapshots the canvas as a PNG data URL and hands it
// off exactly like an uploaded photo would — everything downstream
// (auto-detect, calibration, boundary lock, ring picks, apply to Round) is
// the SAME PhotoTraceForm, unmodified.
function DrawingCanvas({ onDone }: { onDone: (dataUrl: string, width: number, height: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const dragBoundsRef = useRef<{ start: Point; end: Point } | null>(null);
  const zoomAnchorRef = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [zoom, setZoom] = useState(1);
  const scaleRef = useRef(zoom);
  useEffect(() => {
    scaleRef.current = zoom;
  }, [zoom]);
  const [brushWidth, setBrushWidth] = useState<number>(WIDTHS[1].px);
  // Doubles as "defaults for the next new shape" AND "live properties of the
  // selected shape" — selecting an object loads its values in here, and
  // editing while something's selected writes straight back into it.
  const [cornerRadius, setCornerRadius] = useState(0);
  const [sides, setSides] = useState(DEFAULT_SIDES);
  const [starPointCount, setStarPointCount] = useState(DEFAULT_STAR_POINTS);
  const [innerDepth, setInnerDepth] = useState(DEFAULT_INNER_DEPTH);
  const [objects, setObjects] = useState<DrawObject[]>([]);
  const [redoStack, setRedoStack] = useState<DrawObject[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ kind: ObjectKind; points: Point[] } | null>(null);
  // Arc is a 2-phase tool: drag out the chord (start/end) like the line
  // tool, then — WITHOUT holding the mouse — move to bow the curve and
  // click to confirm. pendingArc holds the fixed chord during that second,
  // "adjust and confirm" phase.
  const [pendingArc, setPendingArc] = useState<{ start: Point; end: Point } | null>(null);

  const selected = objects.find((o) => o.id === selectedId) ?? null;

  function pushHistory() {
    setRedoStack([]);
  }

  function updateObject(id: string, patch: Partial<DrawObject>) {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function selectTool(next: Tool) {
    setTool(next);
    setPendingArc(null);
    setDraft(null);
    dragModeRef.current = null;
    dragBoundsRef.current = null;
    if (next !== "select") setSelectedId(null);
  }

  function selectObject(id: string | null) {
    setSelectedId(id);
    const obj = id ? objects.find((o) => o.id === id) : null;
    if (obj) {
      setCornerRadius(obj.cornerRadius);
      setSides(obj.sides);
      setStarPointCount(obj.starPointCount);
      setInnerDepth(obj.innerDepth);
    }
  }

  function applyCornerRadius(v: number) {
    setCornerRadius(v);
    if (selectedId) updateObject(selectedId, { cornerRadius: v });
  }
  function applySides(v: number) {
    setSides(v);
    if (selected && selected.kind === "polygon") updateObject(selected.id, { sides: v, localPoints: unitPolygon(v) });
  }
  function applyStarPointCount(v: number) {
    setStarPointCount(v);
    if (selected && selected.kind === "star") updateObject(selected.id, { starPointCount: v, localPoints: unitStar(v, innerDepth) });
  }
  function applyInnerDepth(v: number) {
    setInnerDepth(v);
    if (selected && selected.kind === "star") updateObject(selected.id, { innerDepth: v, localPoints: unitStar(starPointCount, v) });
  }

  // Cursor-anchored wheel zoom, same pattern as PhotoTraceForm's.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const viewX = e.clientX - rect.left;
      const viewY = e.clientY - rect.top;
      zoomAnchorRef.current = {
        x: (container!.scrollLeft + viewX) / scaleRef.current,
        y: (container!.scrollTop + viewY) / scaleRef.current,
        viewX,
        viewY,
      };
      setZoom((z) => clamp(z * (1 - e.deltaY * WHEEL_ZOOM_FACTOR), ZOOM_MIN, ZOOM_MAX));
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    const anchor = zoomAnchorRef.current;
    if (!container || !anchor) return;
    container.scrollLeft = anchor.x * zoom - anchor.viewX;
    container.scrollTop = anchor.y * zoom - anchor.viewY;
    zoomAnchorRef.current = null;
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_W; x += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    // Center guide only — purely visual, not interactive here (the real
    // draggable axis appears once PhotoTraceForm takes over).
    ctx.strokeStyle = "rgba(37,99,235,0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    function strokePath(points: Point[], width: number) {
      if (points.length < 2) return;
      ctx!.lineWidth = width;
      ctx!.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx!.moveTo(p.x, p.y);
        else ctx!.lineTo(p.x, p.y);
      });
      ctx!.stroke();
    }

    ctx.strokeStyle = "#1f2937";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    objects.forEach((obj) => strokePath(getWorldPoints(obj), obj.strokeWidth));
    if (draft) strokePath(draft.points, brushWidth);

    if (selected) {
      const corners = [
        localToWorld({ x: -1, y: -1 }, selected),
        localToWorld({ x: 1, y: -1 }, selected),
        localToWorld({ x: 1, y: 1 }, selected),
        localToWorld({ x: -1, y: 1 }, selected),
      ];
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      corners.forEach((p, i) => (i === 0 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      const rotateHandle = localToWorld({ x: 0, y: -ROTATE_HANDLE_OFFSET }, selected);
      const topMid = localToWorld({ x: 0, y: -1 }, selected);
      ctx.beginPath();
      ctx.moveTo(topMid.x, topMid.y);
      ctx.lineTo(rotateHandle.x, rotateHandle.y);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      RESIZE_HANDLES.forEach((h) => {
        const p = localToWorld({ x: h.sx, y: h.sy }, selected);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, HANDLE_DISPLAY_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.stroke();
      });
      ctx.beginPath();
      ctx.arc(rotateHandle.x, rotateHandle.y, HANDLE_DISPLAY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [objects, draft, selected, brushWidth]);

  function toCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  function hitTestObject(p: Point): DrawObject | null {
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const world = getWorldPoints(obj);
      if (obj.closed ? pointInPolygon(p, world) || pointsNear(world, p, HIT_STROKE_RADIUS) : pointsNear(world, p, HIT_STROKE_RADIUS)) return obj;
    }
    return null;
  }

  function hitTestHandle(p: Point): { type: "rotate" } | { type: "resize"; sx: -1 | 0 | 1; sy: -1 | 0 | 1 } | null {
    if (!selected) return null;
    const rotateHandle = localToWorld({ x: 0, y: -ROTATE_HANDLE_OFFSET }, selected);
    if (Math.hypot(p.x - rotateHandle.x, p.y - rotateHandle.y) <= HANDLE_HIT_RADIUS) return { type: "rotate" };
    for (const h of RESIZE_HANDLES) {
      const hp = localToWorld({ x: h.sx, y: h.sy }, selected);
      if (Math.hypot(p.x - hp.x, p.y - hp.y) <= HANDLE_HIT_RADIUS) return { type: "resize", sx: h.sx, sy: h.sy };
    }
    return null;
  }

  function eraseAt(p: Point) {
    const hit = hitTestObject(p);
    if (!hit) return;
    setObjects(objects.filter((o) => o.id !== hit.id));
    pushHistory();
    if (selectedId === hit.id) setSelectedId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setObjects(objects.filter((o) => o.id !== selectedId));
    pushHistory();
    setSelectedId(null);
  }

  function currentShapeOpts() {
    return { strokeWidth: brushWidth, cornerRadius, sides, starPointCount, innerDepth };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = toCanvasPoint(e);
    if (tool === "eraser") {
      eraseAt(p);
      return;
    }
    if (tool === "select") {
      const handle = hitTestHandle(p);
      if (handle && selected) {
        dragModeRef.current = handle.type === "rotate" ? { type: "rotate", id: selected.id } : { type: "resize", id: selected.id, sx: handle.sx, sy: handle.sy };
        return;
      }
      const hit = hitTestObject(p);
      if (hit) {
        selectObject(hit.id);
        dragModeRef.current = { type: "move", id: hit.id, startMouse: p, startCx: hit.cx, startCy: hit.cy };
        return;
      }
      selectObject(null);
      return;
    }
    if (tool === "arc") {
      if (pendingArc) {
        // Second click: confirm the bowed curve shown since the last move.
        if (draft) {
          const obj = buildObject("arc", draft.points, currentShapeOpts());
          setObjects([...objects, obj]);
          pushHistory();
          selectTool("select");
          selectObject(obj.id);
        }
        setDraft(null);
        setPendingArc(null);
        return;
      }
      dragModeRef.current = { type: "draw" };
      dragBoundsRef.current = { start: p, end: p };
      setDraft({ kind: "arc", points: [p] });
      return;
    }
    dragModeRef.current = { type: "draw" };
    dragBoundsRef.current = { start: p, end: p };
    const kind = tool as ObjectKind;
    setDraft({ kind, points: [p] });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = toCanvasPoint(e);
    if (tool === "arc" && pendingArc) {
      // Bow-adjustment phase: tracks the cursor even though the mouse
      // button isn't held, mirroring how a click-to-place curve tool works.
      setDraft({ kind: "arc", points: arcLocalPoints(pendingArc.start, pendingArc.end, p) });
      return;
    }
    const mode = dragModeRef.current;
    if (!mode) return;
    if (mode.type === "move") {
      updateObject(mode.id, { cx: mode.startCx + (p.x - mode.startMouse.x), cy: mode.startCy + (p.y - mode.startMouse.y) });
      return;
    }
    if (mode.type === "resize") {
      const obj = objects.find((o) => o.id === mode.id);
      if (!obj) return;
      const anchorLocal = { x: -mode.sx, y: -mode.sy };
      const anchorWorld = localToWorld(anchorLocal, obj);
      const worldDelta = { x: p.x - anchorWorld.x, y: p.y - anchorWorld.y };
      const localDelta = rotateVec(worldDelta, -obj.rotation);
      let newW = obj.w;
      let newH = obj.h;
      if (mode.sx !== 0) newW = Math.max(MIN_OBJECT_SIZE, localDelta.x * mode.sx);
      if (mode.sy !== 0) newH = Math.max(MIN_OBJECT_SIZE, localDelta.y * mode.sy);
      const anchorScaledLocal = { x: (anchorLocal.x * newW) / 2, y: (anchorLocal.y * newH) / 2 };
      const anchorWorldNew = rotateVec(anchorScaledLocal, obj.rotation);
      updateObject(mode.id, { w: newW, h: newH, cx: anchorWorld.x - anchorWorldNew.x, cy: anchorWorld.y - anchorWorldNew.y });
      return;
    }
    if (mode.type === "rotate") {
      const obj = objects.find((o) => o.id === mode.id);
      if (!obj) return;
      const angle = Math.atan2(p.x - obj.cx, -(p.y - obj.cy));
      updateObject(mode.id, { rotation: angle });
      return;
    }
    // mode.type === "draw"
    if (dragBoundsRef.current) dragBoundsRef.current = { start: dragBoundsRef.current.start, end: p };
    setDraft((prev) => {
      if (!prev) return prev;
      const start = prev.points[0];
      if (prev.kind === "pen") return { ...prev, points: [...prev.points, p] };
      if (prev.kind === "line") return { ...prev, points: [start, p] };
      const raw =
        prev.kind === "rect"
          ? rectDragPoints(start, p)
          : prev.kind === "ellipse"
            ? ellipseDragPoints(start, p)
            : prev.kind === "polygon"
              ? polygonDragPoints(start, p, sides)
              : prev.kind === "star"
                ? starDragPoints(start, p, starPointCount, innerDepth)
                : [start, p];
      const rounded = ROUNDABLE_KINDS.has(prev.kind) ? roundCorners(raw as Point[], cornerRadius) : (raw as Point[]);
      return { ...prev, points: rounded };
    });
  }

  function handleMouseUp() {
    const mode = dragModeRef.current;
    dragModeRef.current = null;
    if (!mode || mode.type !== "draw") return;

    if (tool === "arc") {
      if (!draft) return;
      const start = draft.points[0];
      const end = draft.points[draft.points.length - 1];
      setPendingArc({ start, end });
      return;
    }

    if (!draft) {
      dragBoundsRef.current = null;
      return;
    }
    const bounds = dragBoundsRef.current;
    dragBoundsRef.current = null;
    if (!bounds || Math.hypot(bounds.end.x - bounds.start.x, bounds.end.y - bounds.start.y) < MIN_DRAG || draft.points.length < 2) {
      setDraft(null);
      return;
    }
    const obj = buildObject(draft.kind, draft.points, currentShapeOpts());
    setObjects([...objects, obj]);
    pushHistory();
    setDraft(null);
    // Canva returns to select/move mode right after placing something, with
    // the new object already selected — so its property panel shows
    // immediately and the user can adjust or reposition it without an extra click.
    selectTool("select");
    selectObject(obj.id);
  }

  const displayW = Math.min(DISPLAY_MAX_W, CANVAS_W * zoom);
  const displayH = Math.min(DISPLAY_MAX_H, CANVAS_H * zoom);
  const panelKind: ObjectKind | Tool | null = selected ? selected.kind : SHAPE_TOOLS.has(tool) ? tool : null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "select", label: "↖ Chọn" },
            { key: "pen", label: "✏️ Bút vẽ" },
            { key: "line", label: "／ Nét thẳng" },
            { key: "arc", label: "⌒ Cung" },
            { key: "eraser", label: "🧹 Tẩy" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => selectTool(opt.key)}
            className={`h-8 rounded-md border px-2.5 text-[12px] font-semibold ${
              tool === opt.key ? "border-accent bg-accent text-white" : "border-line text-text-muted hover:text-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <select
          value={SHAPE_TOOLS.has(tool) ? tool : ""}
          onChange={(e) => selectTool(e.target.value as Tool)}
          className={`h-8 rounded-md border px-2 text-[12px] font-semibold ${
            SHAPE_TOOLS.has(tool) ? "border-accent bg-accent text-white" : "border-line text-text-muted hover:text-text"
          }`}
        >
          <option value="" disabled>
            Hình có sẵn…
          </option>
          {SHAPE_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key} className="bg-surface text-text">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (objects.length === 0) return;
            setRedoStack([objects, ...redoStack]);
            setObjects(objects.slice(0, -1));
            if (selectedId === objects[objects.length - 1]?.id) setSelectedId(null);
          }}
          disabled={objects.length === 0}
          className="text-[12px] font-semibold text-text-muted hover:text-text disabled:opacity-30"
        >
          ↶ Hoàn tác
        </button>
        <button
          type="button"
          onClick={() => {
            if (redoStack.length === 0) return;
            setObjects(redoStack[0]);
            setRedoStack(redoStack.slice(1));
          }}
          disabled={redoStack.length === 0}
          className="text-[12px] font-semibold text-text-muted hover:text-text disabled:opacity-30"
        >
          ↷ Làm lại
        </button>
        <button
          type="button"
          onClick={() => {
            setObjects([]);
            setRedoStack([]);
            setSelectedId(null);
          }}
          disabled={objects.length === 0}
          className="text-[12px] font-semibold text-red hover:underline disabled:opacity-30"
        >
          Xóa hết
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold text-text-muted">Độ dày nét</span>
          {WIDTHS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => {
                setBrushWidth(w.px);
                if (selectedId) updateObject(selectedId, { strokeWidth: w.px });
              }}
              className={`h-7 rounded-md border px-2.5 text-[12px] font-semibold ${
                (selected ? selected.strokeWidth : brushWidth) === w.px ? "border-accent bg-accent text-white" : "border-line text-text-muted hover:text-text"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
            disabled={zoom <= ZOOM_MIN}
            className="h-7 w-7 rounded-md border border-line text-[13px] font-bold text-text-muted hover:text-text disabled:opacity-40"
          >
            −
          </button>
          <span className="w-12 text-center text-[12px] text-text-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
            disabled={zoom >= ZOOM_MAX}
            className="h-7 w-7 rounded-md border border-line text-[13px] font-bold text-text-muted hover:text-text disabled:opacity-40"
          >
            +
          </button>
        </div>

        {selected && (
          <button type="button" onClick={deleteSelected} className="text-[12px] font-semibold text-red hover:underline">
            🗑 Xóa hình đang chọn
          </button>
        )}
      </div>

      {panelKind && (ROUNDABLE_KINDS.has(panelKind as ObjectKind) || panelKind === "polygon" || panelKind === "star") && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-bg p-2.5">
          {ROUNDABLE_KINDS.has(panelKind as ObjectKind) && <SliderField label="Bo góc" value={cornerRadius} min={0} max={MAX_CORNER_RADIUS} onChange={applyCornerRadius} />}
          {panelKind === "polygon" && <SliderField label="Số cạnh" value={sides} min={MIN_SIDES} max={MAX_SIDES} onChange={applySides} />}
          {panelKind === "star" && (
            <>
              <SliderField label="Số cánh" value={starPointCount} min={MIN_SIDES} max={MAX_SIDES} onChange={applyStarPointCount} />
              <SliderField label="Độ sâu trong" value={innerDepth} min={10} max={90} onChange={applyInnerDepth} />
            </>
          )}
        </div>
      )}

      <div ref={scrollRef} className="self-center overflow-auto rounded-md border border-line" style={{ width: displayW, height: displayH }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
          className={tool === "select" ? "block cursor-default" : "block cursor-crosshair"}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      <p className="text-[11.5px] text-text-faint">
        {tool === "arc" && pendingArc
          ? "Di chuyển chuột để chỉnh độ cong của cung, click để xác nhận."
          : tool === "select"
            ? "Click 1 hình để chọn — kéo 8 chấm quanh hình để phóng to/nhỏ, kéo chấm phía trên để xoay, kéo thân hình để di chuyển."
            : "Vẽ nét biên dạng một bên (đối xứng qua trục tâm giữa) — càng gần đúng tỉ lệ thật càng tốt, có thể chỉnh chi tiết ở bước sau. Lăn chuột để zoom."}
      </p>

      <button
        type="button"
        disabled={objects.length === 0}
        onClick={() => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          onDone(canvas.toDataURL("image/png"), CANVAS_W, CANVAS_H);
        }}
        className="h-9 rounded-lg bg-accent text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        Xong, dò biên dạng →
      </button>
    </div>
  );
}

// Local (drag-space, not yet an object) shape builders — same math as the
// unit generators, but directly in the drag's own world coordinates, used
// only while a shape is still being dragged out for the live preview.
function rectDragPoints(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
    { x: a.x, y: a.y },
  ];
}
function ellipseDragPoints(a: Point, b: Point): Point[] {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const pts: Point[] = [];
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const t = (i / CURVE_SEGMENTS) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return pts;
}
function polygonDragPoints(a: Point, b: Point, sides: number): Point[] {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const pts: Point[] = [];
  for (let i = 0; i <= sides; i++) {
    const t = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return pts;
}
function starDragPoints(a: Point, b: Point, points: number, innerDepthPct: number): Point[] {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const innerRatio = clamp(innerDepthPct, 5, 95) / 100;
  const pts: Point[] = [];
  const n = points * 2;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : innerRatio;
    pts.push({ x: cx + rx * r * Math.cos(t), y: cy + ry * r * Math.sin(t) });
  }
  return pts;
}

export function DrawShapeForm({
  value,
  onChange,
  onApply,
}: {
  value: PhotoTraceInput;
  onChange: (v: PhotoTraceInput) => void;
  onApply: (rings: RingInput[], photoCurve: { z: number; diameter: number }[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(true);

  if (value.imageDataUrl) {
    return <PhotoTraceForm value={value} onChange={onChange} onApply={onApply} />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-line bg-surface p-8 text-center">
      <span className="text-[13px] font-semibold text-text-muted">Vẽ tay biên dạng</span>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-[12.5px] font-bold text-white hover:bg-accent-hover"
      >
        Mở trình vẽ
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-[860px] flex-col gap-3 overflow-auto rounded-xl bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-text">Vẽ tay biên dạng</span>
              <button type="button" onClick={() => setModalOpen(false)} className="text-[13px] font-bold text-text-muted hover:text-text">
                ✕
              </button>
            </div>
            <DrawingCanvas
              onDone={(dataUrl, width, height) => {
                onChange({ ...DEFAULT_PHOTO_TRACE, imageDataUrl: dataUrl, imageWidth: width, imageHeight: height, axisXPx: width / 2 });
                setModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
