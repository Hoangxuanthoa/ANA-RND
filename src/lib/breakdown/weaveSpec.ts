// "Quy cách hàng đan" — Admin-editable rules that auto-fill a product's steel
// frame (number of ribs, number of horizontal rings, FI, colour…) from its
// dimensions, so the person entering a product only picks the shape and sizes.
// One config per shape, stored in the DB (WeaveSpec) and edited in Settings —
// NOTHING here is a hard-coded business rule: every number a rule uses lives in
// the config. This file is pure (no React / no DB) so the server can validate a
// saved config with the same code the studio applies it with.
//
// Round is the first shape. A rule is a table of ranges on one driver:
//   "Ø miệng từ 200 đến 250 → 8 nan"
// Both ends of a range are inclusive; a value that falls in a gap between two
// rows takes the nearest row BELOW it (the editor warns about gaps/overlaps); a
// value outside the whole table gets no value (the field stays manual).
import type { ProductState, RingInput } from "./geometry/types";

export type SpecField = "verticalCount" | "bottomRadialCount" | "lidRadialCount" | "lidWallCount" | "ringCount";
export type SpecDriver = "mouthDiameter" | "height";

export interface SpecRow {
  from: number;
  to: number;
  value: number;
}
export interface SpecRule {
  by: SpecDriver;
  rows: SpecRow[];
}

export interface RoundSpecConfig {
  // Same for every Round product, not dependent on size.
  fixed: { diameterMm: number; colorPreset: "beige" | "black" | "white"; ringPlacement: "inside" | "outside" };
  rules: Record<SpecField, SpecRule>;
}

export const SPEC_FIELDS: SpecField[] = ["verticalCount", "ringCount", "bottomRadialCount", "lidRadialCount", "lidWallCount"];

export const SPEC_FIELD_LABEL: Record<SpecField, string> = {
  verticalCount: "Số nan dọc thân",
  ringCount: "Số vòng ngang",
  bottomRadialCount: "Số nan đáy (từ tâm)",
  lidRadialCount: "Số nan nắp (từ tâm)",
  lidWallCount: "Số nan dọc thân nắp (nắp trùm)",
};

export const SPEC_DRIVER_LABEL: Record<SpecDriver, string> = {
  mouthDiameter: "Ø miệng (mm)",
  height: "Chiều cao (mm)",
};

const DRIVER_OF: Record<SpecField, SpecDriver> = {
  verticalCount: "mouthDiameter",
  ringCount: "height",
  bottomRadialCount: "mouthDiameter",
  lidRadialCount: "mouthDiameter",
  lidWallCount: "mouthDiameter",
};

export function defaultRoundSpec(): RoundSpecConfig {
  const rules = Object.fromEntries(SPEC_FIELDS.map((f) => [f, { by: DRIVER_OF[f], rows: [] }])) as unknown as Record<SpecField, SpecRule>;
  return { fixed: { diameterMm: 3, colorPreset: "beige", ringPlacement: "inside" }, rules };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Merges whatever was stored onto the defaults and drops anything malformed, so
// a half-saved or older config can never crash the studio.
export function normalizeRoundSpec(raw: unknown): RoundSpecConfig {
  const base = defaultRoundSpec();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as { fixed?: Partial<RoundSpecConfig["fixed"]>; rules?: Partial<Record<SpecField, { rows?: unknown }>> };
  if (r.fixed) {
    if (finite(r.fixed.diameterMm) && r.fixed.diameterMm > 0) base.fixed.diameterMm = r.fixed.diameterMm;
    if (r.fixed.colorPreset === "beige" || r.fixed.colorPreset === "black" || r.fixed.colorPreset === "white") base.fixed.colorPreset = r.fixed.colorPreset;
    if (r.fixed.ringPlacement === "inside" || r.fixed.ringPlacement === "outside") base.fixed.ringPlacement = r.fixed.ringPlacement;
  }
  for (const f of SPEC_FIELDS) {
    const rows = r.rules?.[f]?.rows;
    if (!Array.isArray(rows)) continue;
    base.rules[f].rows = rows
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

// ---- applying a config to a product ----------------------------------------

function mouthAndBase(rings: RingInput[]) {
  const sorted = [...rings].sort((a, b) => b.z - a.z);
  return { sorted, mouth: sorted[0], base: sorted[sorted.length - 1] };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

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

export function applyRoundSpec(p: ProductState, cfg: RoundSpecConfig, opts: { full: boolean }): ProductState {
  if (p.shape !== "round" || p.rings.length < 2) return p;
  const manual = new Set<string>(opts.full ? [] : (p.specManual ?? []));
  const { mouth, base } = mouthAndBase(p.rings);
  const ctx: Record<SpecDriver, number> = { mouthDiameter: mouth.diameter, height: mouth.z - base.z };
  const pick = (f: SpecField) => (manual.has(f) ? null : lookupRule(cfg.rules[f], ctx[cfg.rules[f].by]));

  const frame = { ...p.frame };
  if (opts.full) {
    const d = cfg.fixed.diameterMm;
    Object.assign(frame, {
      verticalMode: "continuous" as const,
      ringPlacement: cfg.fixed.ringPlacement,
      bottomPattern: "radial" as const,
      bottomRadialMode: "center" as const,
      lidPattern: "radial" as const,
      lidRadialMode: "center" as const,
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
    });
  }
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

  let rings = p.rings;
  // A locked/traced body is driven by its own curve, not by the rings — leave it be.
  if (!p.photoCurve || p.photoCurve.length < 2) {
    const n = pick("ringCount");
    if (n !== null) rings = layoutRings(p.rings, n);
  }
  return { ...p, frame, rings, specAuto: true, specManual: [...manual] };
}

// Fields the person has now taken over by hand (so a later size change won't
// overwrite them). Judged from THEIR edit, before any auto-fill is applied: the
// frame fields the rules drive, or a change to the middle rings (the end rings
// are just "Miệng"/"Đáy" sizes, which are what drives the rules).
const FRAME_KEY_TO_FIELD: Record<string, SpecField> = {
  verticalCount: "verticalCount",
  bottomRadialCount: "bottomRadialCount",
  lidRadialCount: "lidRadialCount",
  lidWallCount: "lidWallCount",
};

function middleRingsChanged(a: RingInput[], b: RingInput[]): boolean {
  const ma = a.slice(1, -1);
  const mb = b.slice(1, -1);
  if (ma.length !== mb.length) return true;
  return ma.some((r, i) => r.z !== mb[i].z || r.diameter !== mb[i].diameter || r.transition !== mb[i].transition || r.curveDepth !== mb[i].curveDepth);
}

export function manualAfterEdit(prev: ProductState, patch: Partial<ProductState>): string[] {
  const manual = new Set(prev.specManual ?? []);
  if (patch.frame) {
    const before = prev.frame as unknown as Record<string, unknown>;
    const after = patch.frame as unknown as Record<string, unknown>;
    for (const [key, field] of Object.entries(FRAME_KEY_TO_FIELD)) if (after[key] !== before[key]) manual.add(field);
  }
  if (patch.rings && middleRingsChanged(prev.rings, patch.rings)) manual.add("ringCount");
  return [...manual];
}
