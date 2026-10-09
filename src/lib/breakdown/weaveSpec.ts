// "Quy cách hàng đan" — Admin-editable rules that auto-fill a product's steel
// frame (number of ribs, number of horizontal rings, FI, colour…) from its
// dimensions, so the person entering a product only picks the shape and sizes.
// One config per shape, stored in the DB (WeaveSpec) and edited in Cài đặt Bóc
// tách — NOTHING here is a hard-coded business rule: every number a rule uses
// lives in the config. This file is pure (no React / no DB) so the server can
// validate a saved config with the same code the studio applies it with.
//
// A rule is a table of ranges on one driver (the person picks the driver per
// rule): "Ø miệng từ 200 đến 250 → 8 nan". Both ends of a range are inclusive; a
// value that falls in a gap between two rows takes the nearest row BELOW it (the
// editor warns about gaps/overlaps); a value outside the whole table gets no
// value (that field stays manual).
import type { ProductState, RingInput } from "./geometry/types";

export type SpecShape = "round" | "square" | "rectangle" | "oval" | "ellipse";
export const SPEC_SHAPES: SpecShape[] = ["round", "square", "rectangle", "oval", "ellipse"];
export const SPEC_SHAPE_LABEL: Record<SpecShape, string> = { round: "Round", square: "Square", rectangle: "Rectangle", oval: "Oval", ellipse: "Ellipse" };

export type SpecDriver = "mouthDiameter" | "mouthLength" | "mouthWidth" | "height";
export const SPEC_DRIVER_LABEL: Record<SpecDriver, string> = {
  mouthDiameter: "Ø miệng (mm)",
  mouthLength: "Chiều dài miệng (mm)",
  mouthWidth: "Chiều rộng miệng (mm)",
  height: "Chiều cao (mm)",
};

export interface SpecRow {
  from: number;
  to: number;
  value: number;
}
export interface SpecRule {
  by: SpecDriver;
  rows: SpecRow[];
}

// ---- what each shape can be configured with --------------------------------

export interface SpecFieldDef {
  key: string;
  label: string;
  unit: "nan" | "vòng";
  drivers: SpecDriver[]; // the person may choose any of these as the rule's driver
  defaultDriver: SpecDriver;
  hint?: string;
}
// A structural choice that's the same for every product of the shape (not size-dependent).
export interface FixedOptionDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}
export interface ShapeSpecDef {
  fields: SpecFieldDef[];
  fixedOptions: FixedOptionDef[];
  fixedNote?: string;
}

const RECT_DRIVERS: SpecDriver[] = ["mouthLength", "mouthWidth", "height"];
const AXIS = [
  { value: "length", label: "Theo chiều dài" },
  { value: "width", label: "Theo chiều rộng" },
];
const RING_HINT = "Vòng ngang đặt cách đều theo chiều cao, kích thước nội suy thẳng từ miệng xuống đáy.";

const rectFields = (square: boolean): SpecFieldDef[] => [
  ...(square
    ? [{ key: "ribsPerFace", label: "Số nan mỗi mặt", unit: "nan" as const, drivers: RECT_DRIVERS, defaultDriver: "mouthLength" as const, hint: "Kiểu \"theo góc bo + cạnh\"." }]
    : [
        { key: "lengthRibCount", label: "Số nan mặt dài", unit: "nan" as const, drivers: RECT_DRIVERS, defaultDriver: "mouthLength" as const, hint: "Kiểu \"theo góc bo + cạnh\"." },
        { key: "widthRibCount", label: "Số nan mặt rộng", unit: "nan" as const, drivers: RECT_DRIVERS, defaultDriver: "mouthWidth" as const, hint: "Kiểu \"theo góc bo + cạnh\"." },
      ]),
  { key: "bodyRibsPerHalf", label: "Số nan mỗi nửa (cố định 2 đầu)", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength", hint: "Chỉ dùng khi kiểu chia là \"Cố định 2 đầu\"." },
  { key: "bodyRibsPerQuarter", label: "Số nan mỗi 1/4 chu vi (chia đều)", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength", hint: "Chỉ dùng khi kiểu chia là \"Chia đều\"." },
  { key: "bottomCount", label: "Số nan đáy", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength" },
  { key: "lidCount", label: "Số nan nắp", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength" },
  { key: "ringCount", label: "Số vòng ngang", unit: "vòng", drivers: ["height", ...RECT_DRIVERS.filter((d) => d !== "height")], defaultDriver: "height", hint: RING_HINT },
];

const ovalFields: SpecFieldDef[] = [
  { key: "bodyRibsPerHalf", label: "Số nan mỗi nửa (cố định 2 đầu)", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength", hint: "Chỉ dùng khi kiểu chia là \"Cố định 2 đầu\"." },
  { key: "bodyRibsPerQuarter", label: "Số nan mỗi 1/4 chu vi (chia đều)", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength", hint: "Chỉ dùng khi kiểu chia là \"Chia đều\"." },
  { key: "bottomCount", label: "Số nan đáy", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength" },
  { key: "lidCount", label: "Số nan nắp", unit: "nan", drivers: RECT_DRIVERS, defaultDriver: "mouthLength" },
  { key: "ringCount", label: "Số vòng ngang", unit: "vòng", drivers: ["height", "mouthLength", "mouthWidth"], defaultDriver: "height", hint: RING_HINT },
];

const rectFixedOptions: FixedOptionDef[] = [
  {
    key: "bodyRibMode",
    label: "Kiểu chia nan dọc",
    defaultValue: "edges",
    options: [
      { value: "edges", label: "Theo góc bo + cạnh" },
      { value: "fixed_tips", label: "Cố định 2 đầu (theo chu vi)" },
      { value: "even", label: "Chia đều, không cố định (theo chu vi)" },
    ],
  },
  {
    key: "cornerRibMode",
    label: "Nan ở góc bo",
    defaultValue: "bisector",
    options: [
      { value: "bisector", label: "1 nan (tâm góc bo)" },
      { value: "tangents", label: "2 nan (điểm tiếp giáp)" },
      { value: "both", label: "3 nan (cả 2)" },
    ],
  },
  { key: "bottomDirection", label: "Hướng nan đáy", defaultValue: "width", options: AXIS },
  { key: "lidDirection", label: "Hướng nan nắp", defaultValue: "width", options: AXIS },
];
const ovalFixedOptions: FixedOptionDef[] = [
  {
    key: "bodyRibMode",
    label: "Kiểu chia nan dọc",
    defaultValue: "fixed_tips",
    options: [
      { value: "fixed_tips", label: "Cố định 2 đầu" },
      { value: "even", label: "Chia đều, không cố định" },
    ],
  },
  { key: "bottomDirection", label: "Hướng nan đáy", defaultValue: "width", options: AXIS },
  { key: "lidDirection", label: "Hướng nan nắp", defaultValue: "width", options: AXIS },
];

export const SHAPE_SPEC_DEFS: Record<SpecShape, ShapeSpecDef> = {
  round: {
    fixedNote: "Kiểu nan dọc liên tục miệng → đáy; đáy và nắp chia nan từ tâm (tất cả đi từ tâm); 1 FI cho tất cả.",
    fixedOptions: [],
    fields: [
      { key: "verticalCount", label: "Số nan dọc thân", unit: "nan", drivers: ["mouthDiameter", "height"], defaultDriver: "mouthDiameter" },
      { key: "ringCount", label: "Số vòng ngang", unit: "vòng", drivers: ["height", "mouthDiameter"], defaultDriver: "height", hint: RING_HINT },
      { key: "bottomRadialCount", label: "Số nan đáy (từ tâm)", unit: "nan", drivers: ["mouthDiameter", "height"], defaultDriver: "mouthDiameter" },
      { key: "lidRadialCount", label: "Số nan nắp (từ tâm)", unit: "nan", drivers: ["mouthDiameter", "height"], defaultDriver: "mouthDiameter" },
      { key: "lidWallCount", label: "Số nan dọc thân nắp (nắp trùm)", unit: "nan", drivers: ["mouthDiameter", "height"], defaultDriver: "mouthDiameter" },
    ],
  },
  square: { fixedOptions: rectFixedOptions, fields: rectFields(true) },
  rectangle: { fixedOptions: rectFixedOptions, fields: rectFields(false) },
  oval: { fixedOptions: ovalFixedOptions, fields: ovalFields },
  ellipse: { fixedOptions: ovalFixedOptions, fields: ovalFields },
};

export interface ShapeSpecConfig {
  // Same for every product of the shape, not dependent on size.
  fixed: {
    diameterMm: number;
    colorPreset: "beige" | "black" | "white";
    ringPlacement: "inside" | "outside";
    options: Record<string, string>;
  };
  rules: Record<string, SpecRule>;
}

export function defaultSpec(shape: SpecShape): ShapeSpecConfig {
  const def = SHAPE_SPEC_DEFS[shape];
  return {
    fixed: {
      diameterMm: 3,
      colorPreset: "beige",
      ringPlacement: "inside",
      options: Object.fromEntries(def.fixedOptions.map((o) => [o.key, o.defaultValue])),
    },
    rules: Object.fromEntries(def.fields.map((f) => [f.key, { by: f.defaultDriver, rows: [] }])),
  };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Merges whatever was stored onto the defaults and drops anything malformed, so
// a half-saved or older config can never crash the studio.
export function normalizeSpec(shape: SpecShape, raw: unknown): ShapeSpecConfig {
  const base = defaultSpec(shape);
  const def = SHAPE_SPEC_DEFS[shape];
  if (!raw || typeof raw !== "object") return base;
  const r = raw as { fixed?: Partial<ShapeSpecConfig["fixed"]>; rules?: Record<string, { by?: unknown; rows?: unknown }> };
  if (r.fixed) {
    if (finite(r.fixed.diameterMm) && r.fixed.diameterMm > 0) base.fixed.diameterMm = r.fixed.diameterMm;
    if (r.fixed.colorPreset === "beige" || r.fixed.colorPreset === "black" || r.fixed.colorPreset === "white") base.fixed.colorPreset = r.fixed.colorPreset;
    if (r.fixed.ringPlacement === "inside" || r.fixed.ringPlacement === "outside") base.fixed.ringPlacement = r.fixed.ringPlacement;
    for (const o of def.fixedOptions) {
      const v = r.fixed.options?.[o.key];
      if (typeof v === "string" && o.options.some((x) => x.value === v)) base.fixed.options[o.key] = v;
    }
  }
  for (const f of def.fields) {
    const stored = r.rules?.[f.key];
    if (!stored) continue;
    if (typeof stored.by === "string" && f.drivers.includes(stored.by as SpecDriver)) base.rules[f.key].by = stored.by as SpecDriver;
    if (!Array.isArray(stored.rows)) continue;
    base.rules[f.key].rows = stored.rows
      .filter((x): x is SpecRow => !!x && finite((x as SpecRow).from) && finite((x as SpecRow).to) && finite((x as SpecRow).value))
      .map((x) => ({ from: x.from, to: x.to, value: Math.max(0, Math.round(x.value)) }))
      .sort((a, b) => a.from - b.from);
  }
  return base;
}

export function lookupRule(rule: SpecRule, x: number): number | null {
  if (!Number.isFinite(x)) return null;
  const rows = [...rule.rows].sort((a, b) => a.from - b.from);
  const hit = rows.find((row) => x >= row.from && x <= row.to);
  if (hit) return hit.value;
  // In a gap between two rows → nearest row below.
  const below = rows.filter((row) => row.to < x);
  const above = rows.some((row) => row.from > x);
  if (below.length > 0 && above) return below[below.length - 1].value;
  return null;
}

export function ruleWarnings(rows: SpecRow[]): string[] {
  const out: string[] = [];
  const sorted = [...rows].sort((a, b) => a.from - b.from);
  sorted.forEach((row, i) => {
    if (row.from > row.to) out.push(`Dòng ${row.from}–${row.to}: "từ" lớn hơn "đến".`);
    const next = sorted[i + 1];
    if (!next) return;
    if (next.from <= row.to) out.push(`Chồng lấn: ${row.from}–${row.to} và ${next.from}–${next.to}.`);
    else if (next.from - row.to > 1) out.push(`Khoảng hở: ${row.to}–${next.from} chưa có quy cách.`);
  });
  return out;
}

// ---- reading a product ------------------------------------------------------

interface Ends {
  length: number;
  width: number;
  height: number;
}

// Mouth size + height of a product, per its own shape.
function endsOf(p: ProductState): Ends | null {
  switch (p.shape) {
    case "round": {
      if (p.rings.length < 2) return null;
      const { mouth, base } = mouthAndBase(p.rings);
      return { length: mouth.diameter, width: mouth.diameter, height: mouth.z - base.z };
    }
    case "square":
    case "rectangle": {
      const { mouth, base } = p.rectProfile;
      return { length: mouth.length, width: mouth.width, height: mouth.z - base.z };
    }
    case "oval":
    case "ellipse": {
      const rings = p.shape === "oval" ? p.ovalProfile.rings : p.ellipseProfile.rings;
      if (rings.length < 2) return null;
      const sorted = [...rings].sort((a, b) => b.z - a.z);
      const mouth = sorted[0];
      const base = sorted[sorted.length - 1];
      return { length: mouth.length, width: mouth.width, height: mouth.z - base.z };
    }
    default:
      return null;
  }
}

function driverValue(driver: SpecDriver, ends: Ends): number {
  return driver === "mouthDiameter" || driver === "mouthLength" ? ends.length : driver === "mouthWidth" ? ends.width : ends.height;
}

function mouthAndBase(rings: RingInput[]) {
  const sorted = [...rings].sort((a, b) => b.z - a.z);
  return { sorted, mouth: sorted[0], base: sorted[sorted.length - 1] };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

// ---- laying out the horizontal rings ----------------------------------------

// n horizontal rings between mouth and base: evenly spaced in height, diameter
// interpolated in a straight line (a straight-sided body). The mouth ring's
// bow-to-next is set straight too, so the body matches the rings exactly.
export function layoutRings(rings: RingInput[], n: number): RingInput[] {
  const { mouth, base } = mouthAndBase(rings);
  const count = Math.min(Math.max(Math.round(n), 0), 12);
  const middle: RingInput[] = Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return { z: round1(mouth.z - t * (mouth.z - base.z)), diameter: round1(mouth.diameter + (base.diameter - mouth.diameter) * t), transition: "straight" };
  });
  return [{ ...mouth, transition: "straight" }, ...middle, base];
}

// Same for Oval/Ellipse rings (length × width instead of a diameter).
type LW = { z: number; length: number; width: number; transition?: string };
function layoutLWRings<T extends LW>(rings: T[], n: number): T[] {
  const sorted = [...rings].sort((a, b) => b.z - a.z);
  const mouth = sorted[0];
  const base = sorted[sorted.length - 1];
  const count = Math.min(Math.max(Math.round(n), 0), 12);
  const middle = Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return {
      z: round1(mouth.z - t * (mouth.z - base.z)),
      length: round1(mouth.length + (base.length - mouth.length) * t),
      width: round1(mouth.width + (base.width - mouth.width) * t),
      transition: "straight",
    } as unknown as T;
  });
  return [{ ...mouth, transition: "straight" }, ...middle, base];
}

// ---- applying a config to a product -----------------------------------------

function fixedFrame(p: ProductState, cfg: ShapeSpecConfig): ProductState["frame"] {
  const d = cfg.fixed.diameterMm;
  return {
    ...p.frame,
    diameterMode: "same" as const,
    sameDiameter: d,
    topDiameter: d,
    bodyDiameter: d,
    bottomRimDiameter: d,
    verticalDiameter: d,
    bottomRadialDiameter: d,
    bottomCenterRingDiameter: d,
    bottomParallelDiameter: d,
    lidTopDiameter: d,
    lidWallDiameter: d,
    lidBottomDiameter: d,
    lidRadialDiameter: d,
    lidCenterRingDiameter: d,
    lidParallelDiameter: d,
    handleDiameter: d,
    colorPreset: cfg.fixed.colorPreset,
    ringPlacement: cfg.fixed.ringPlacement,
  };
}

export function applySpec(p: ProductState, cfgs: Partial<Record<SpecShape, ShapeSpecConfig>>, opts: { full: boolean }): ProductState {
  const shape = p.shape as SpecShape;
  const cfg = cfgs[shape];
  if (!cfg || !SPEC_SHAPES.includes(shape)) return p;
  const ends = endsOf(p);
  if (!ends) return p;

  const manual = new Set<string>(opts.full ? [] : (p.specManual ?? []));
  const rules = cfg.rules;
  const pick = (key: string) => {
    const rule = rules[key];
    return !rule || manual.has(key) ? null : lookupRule(rule, driverValue(rule.by, ends));
  };

  let next: ProductState = { ...p };
  if (opts.full) next.frame = fixedFrame(p, cfg);

  if (shape === "round") {
    const frame = { ...next.frame };
    if (opts.full) Object.assign(frame, { verticalMode: "continuous" as const, bottomPattern: "radial" as const, bottomRadialMode: "center" as const, lidPattern: "radial" as const, lidRadialMode: "center" as const });
    const vertical = pick("verticalCount");
    if (vertical !== null) frame.verticalCount = vertical;
    const bottom = pick("bottomRadialCount");
    if (bottom !== null) frame.bottomRadialCount = bottom;
    const lid = pick("lidRadialCount");
    if (lid !== null) frame.lidRadialCount = lid;
    if (p.lid?.mode === "cover") {
      const wall = pick("lidWallCount");
      if (wall !== null) frame.lidWallCount = wall;
    }
    next.frame = frame;
    // A locked/traced body is driven by its own curve, not by the rings — leave it be.
    if (!p.photoCurve || p.photoCurve.length < 2) {
      const n = pick("ringCount");
      if (n !== null) next.rings = layoutRings(p.rings, n);
    }
  } else if (shape === "square" || shape === "rectangle") {
    const rf = { ...next.rectFrame };
    if (opts.full) {
      const o = cfg.fixed.options;
      rf.bodyRibMode = o.bodyRibMode as typeof rf.bodyRibMode;
      rf.cornerRibMode = o.cornerRibMode as typeof rf.cornerRibMode;
      rf.bottomDirection = o.bottomDirection as typeof rf.bottomDirection;
      rf.lidDirection = o.lidDirection as typeof rf.lidDirection;
    }
    if (shape === "square") {
      const face = pick("ribsPerFace");
      if (face !== null) {
        rf.lengthRibCount = face;
        rf.widthRibCount = face;
      }
    } else {
      const l = pick("lengthRibCount");
      if (l !== null) rf.lengthRibCount = l;
      const w = pick("widthRibCount");
      if (w !== null) rf.widthRibCount = w;
    }
    for (const k of ["bodyRibsPerHalf", "bodyRibsPerQuarter", "bottomCount", "lidCount"] as const) {
      const v = pick(k);
      if (v !== null) rf[k] = v;
    }
    next.rectFrame = rf;
    const n = pick("ringCount");
    if (n !== null) {
      const { mouth, base } = p.rectProfile;
      const count = Math.min(Math.max(Math.round(n), 0), 12);
      // Same even spacing RectProfileForm's own "Số vòng ngang" box uses.
      next.rectProfile = { ...p.rectProfile, horizontalRings: Array.from({ length: count }, (_, i) => ({ z: round1(mouth.z - ((mouth.z - base.z) * (i + 1)) / (count + 1)) })) };
    }
  } else {
    // oval / ellipse share the frame fields; only the profile key differs
    const key = shape === "oval" ? "ovalFrame" : "ellipseFrame";
    const ff = { ...(next[key] as unknown as Record<string, unknown>) };
    if (opts.full) {
      const o = cfg.fixed.options;
      ff.bodyRibMode = o.bodyRibMode;
      ff.bottomDirection = o.bottomDirection;
      ff.lidDirection = o.lidDirection;
    }
    for (const k of ["bodyRibsPerHalf", "bodyRibsPerQuarter", "bottomCount", "lidCount"] as const) {
      const v = pick(k);
      if (v !== null) ff[k] = v;
    }
    (next as unknown as Record<string, unknown>)[key] = ff;
    const n = pick("ringCount");
    if (shape === "oval") {
      if (n !== null && (!p.ovalPhotoCurve || p.ovalPhotoCurve.length < 2)) next.ovalProfile = { rings: layoutLWRings(p.ovalProfile.rings, n) };
    } else if (n !== null && (!p.ellipsePhotoCurve || p.ellipsePhotoCurve.length < 2)) {
      next.ellipseProfile = { rings: layoutLWRings(p.ellipseProfile.rings, n) };
    }
  }

  next = { ...next, specAuto: true, specManual: [...manual] };
  return next;
}

// ---- noticing what the person took over by hand -----------------------------

// Fields the person has now taken over (so a later size change won't overwrite
// them). Judged from THEIR edit, before any auto-fill is applied.
const FRAME_KEY_TO_FIELD: Record<string, string> = {
  verticalCount: "verticalCount",
  bottomRadialCount: "bottomRadialCount",
  lidRadialCount: "lidRadialCount",
  lidWallCount: "lidWallCount",
};
const SUBFRAME_KEYS = ["bodyRibsPerHalf", "bodyRibsPerQuarter", "bottomCount", "lidCount"];

type Ring = { z: number; transition?: string; curveDepth?: number; diameter?: number; length?: number; width?: number };
// The end rings are just "Miệng"/"Đáy" sizes (what drives the rules); the middle
// ones are the "vòng ngang" the rule lays out.
function middleRingsChanged(a: Ring[], b: Ring[]): boolean {
  const ma = a.slice(1, -1);
  const mb = b.slice(1, -1);
  if (ma.length !== mb.length) return true;
  return ma.some((r, i) => r.z !== mb[i].z || r.diameter !== mb[i].diameter || r.length !== mb[i].length || r.width !== mb[i].width || r.transition !== mb[i].transition || r.curveDepth !== mb[i].curveDepth);
}

export function manualAfterEdit(prev: ProductState, patch: Partial<ProductState>): string[] {
  const manual = new Set(prev.specManual ?? []);
  const diff = (before: object, after: object, keys: string[], toField: (k: string) => string[]) => {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    for (const k of keys) if (a[k] !== b[k]) toField(k).forEach((f) => manual.add(f));
  };
  if (patch.frame) diff(prev.frame, patch.frame, Object.keys(FRAME_KEY_TO_FIELD), (k) => [FRAME_KEY_TO_FIELD[k]]);
  if (patch.rectFrame) {
    const square = prev.shape === "square";
    diff(prev.rectFrame, patch.rectFrame, ["lengthRibCount", "widthRibCount", ...SUBFRAME_KEYS], (k) =>
      k === "lengthRibCount" ? [square ? "ribsPerFace" : "lengthRibCount"] : k === "widthRibCount" ? [square ? "ribsPerFace" : "widthRibCount"] : [k],
    );
  }
  if (patch.ovalFrame) diff(prev.ovalFrame, patch.ovalFrame, SUBFRAME_KEYS, (k) => [k]);
  if (patch.ellipseFrame) diff(prev.ellipseFrame, patch.ellipseFrame, SUBFRAME_KEYS, (k) => [k]);
  if (patch.rings && middleRingsChanged(prev.rings, patch.rings)) manual.add("ringCount");
  if (patch.ovalProfile && middleRingsChanged(prev.ovalProfile.rings, patch.ovalProfile.rings)) manual.add("ringCount");
  if (patch.ellipseProfile && middleRingsChanged(prev.ellipseProfile.rings, patch.ellipseProfile.rings)) manual.add("ringCount");
  if (patch.rectProfile) {
    const a = prev.rectProfile.horizontalRings;
    const b = patch.rectProfile.horizontalRings;
    if (a.length !== b.length || a.some((r, i) => r.z !== b[i].z)) manual.add("ringCount");
  }
  return [...manual];
}
