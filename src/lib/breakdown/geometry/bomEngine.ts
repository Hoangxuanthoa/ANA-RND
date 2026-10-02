// BOM (Bill of Materials) for Round — steel-rod quantities/weights (grouped
// the way the frame is actually built, from FrameTube.part — see
// frameEngine.ts) and woven-material surface areas (frustum lateral-area
// integral along the body's own profile curve, same math as ANASU's
// calculate_engine.rb `calculate_surfaces`/`cutout_area`, just reorganized
// into the flat per-shape table layout the user's own BOM spreadsheet uses
// instead of that engine's byFi/surface-panel split).
import type { FrameTube } from "./frameEngine";
import { radiusAtZ, type Sample } from "./profileEngine";
import type { HandleInput, MaterialInput } from "./types";

// Standard steel density — matches the real weight of a round rod of a given
// FI (diameter, mm): weight/m (kg) = cross-section area (m²) × density.
export const STEEL_DENSITY_KG_PER_M3 = 7850;

export function steelWeightPerMeterKg(fiMm: number): number {
  const radiusM = fiMm / 2 / 1000;
  return Math.PI * radiusM * radiusM * STEEL_DENSITY_KG_PER_M3;
}

function tubeLengthMm(tube: FrameTube): number {
  let len = 0;
  const pts = tube.points;
  for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
  if (tube.closed && pts.length > 1) len += pts[pts.length - 1].distanceTo(pts[0]);
  return len;
}

export interface BomSteelRow {
  id: string;
  group: string; // "Bộ phận" — Thân/Đáy/Nắp/Quai
  label: string; // "Chi tiết"
  fiMm: number; // "Loại sắt"
  lengthPerPieceM: number;
  quantity: number;
  totalLengthM: number;
  weightKg: number;
}

// Display order only — doesn't affect totals, just reads top-to-bottom the
// way a fabricator would build the piece: body first, then its bottom weave,
// then the lid, then the handle.
const GROUP_ORDER = ["Thân", "Đáy", "Nắp", "Quai"];

// Tubes with the same part label, FI, and length (rounded to the nearest mm
// — welding tolerance, not worth a separate line item over) collapse into
// one row with quantity = how many — e.g. 12 identical "Nan dọc" become one
// "qty 12" row, while a cutout handle's shortened ribs naturally land in
// their OWN row since their length differs, with no special-case needed.
export function buildSteelBom(tubes: FrameTube[]): BomSteelRow[] {
  interface Acc {
    group: string;
    label: string;
    fiMm: number;
    lengthPerPieceM: number;
    quantity: number;
    order: number;
  }
  const map = new Map<string, Acc>();
  let order = 0;
  for (const tube of tubes) {
    if (!tube.part) continue;
    const lengthM = Math.round(tubeLengthMm(tube)) / 1000;
    if (lengthM <= 0) continue;
    const key = `${tube.part.group}|${tube.part.label}|${tube.diameterMm}|${lengthM}`;
    const existing = map.get(key);
    if (existing) existing.quantity += 1;
    else map.set(key, { group: tube.part.group, label: tube.part.label, fiMm: tube.diameterMm, lengthPerPieceM: lengthM, quantity: 1, order: order++ });
  }
  return Array.from(map.values())
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.order - b.order)
    .map((row, i) => ({
      id: `steel-${i}`,
      group: row.group,
      label: row.label,
      fiMm: row.fiMm,
      lengthPerPieceM: row.lengthPerPieceM,
      quantity: row.quantity,
      totalLengthM: Math.round(row.lengthPerPieceM * row.quantity * 1000) / 1000,
      weightKg: Math.round(row.lengthPerPieceM * row.quantity * steelWeightPerMeterKg(row.fiMm) * 100000) / 100000,
    }));
}

// Lateral surface area of the body between two Z bounds — sums each dense
// sample segment's own frustum (truncated-cone) lateral area, clipping the
// first/last segment to the requested range via radiusAtZ interpolation
// (same boundary technique sliceOutline/rowAtZ already use in
// drawingEngine.ts). Reduces exactly to calculate_engine.rb's body_gross
// loop when [zLow, zHigh] spans the whole profile.
function frustumLateralAreaMm2(samples: Sample[], zLow: number, zHigh: number): number {
  let area = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const [, zA] = samples[i];
    const [, zB] = samples[i + 1];
    const segTop = Math.max(zA, zB);
    const segBottom = Math.min(zA, zB);
    const top = Math.min(segTop, zHigh);
    const bottom = Math.max(segBottom, zLow);
    if (top <= bottom) continue;
    const r1 = radiusAtZ(samples, top);
    const r2 = radiusAtZ(samples, bottom);
    const slant = Math.sqrt((r1 - r2) ** 2 + (top - bottom) ** 2);
    area += 2 * Math.PI * ((r1 + r2) / 2) * slant;
  }
  return area;
}

// Area removed by a "khoét thân" cutout handle, clipped to [zLow, zHigh] the
// same way frustumLateralAreaMm2 is — so it can be subtracted from whichever
// material band(s) the opening actually falls in, not just lumped onto one.
// Mirrors calculate_engine.rb's cutout_area exactly (chord-arc width at each
// z, trapezoid area between consecutive z's, ×2 for the two openings).
function cutoutAreaMm2InRange(samples: Sample[], handle: HandleInput, zLow: number, zHigh: number): number {
  if (handle.type !== "cutout") return 0;
  const mouthZ = samples[0][1];
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const width = Math.max(handle.cutoutWidth, 10);
  const cutTop = mouthZ - offset;
  const cutBottom = cutTop - depth;
  let area = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const [, zA] = samples[i];
    const [, zB] = samples[i + 1];
    const segTop = Math.min(Math.max(zA, zB), cutTop, zHigh);
    const segBottom = Math.max(Math.min(zA, zB), cutBottom, zLow);
    if (segTop <= segBottom) continue;
    const r1 = radiusAtZ(samples, segTop);
    const r2 = radiusAtZ(samples, segBottom);
    const arc1 = 2 * r1 * Math.asin(Math.min(Math.max(width / 2 / Math.max(r1, 0.1), 0), 0.999));
    const arc2 = 2 * r2 * Math.asin(Math.min(Math.max(width / 2 / Math.max(r2, 0.1), 0), 0.999));
    const slant = Math.sqrt((r2 - r1) ** 2 + (segTop - segBottom) ** 2);
    area += ((arc1 + arc2) / 2) * slant * 2; // ×2 — the opening exists on both sides (see handlePaths.ts computeCutoutPaths)
  }
  return area;
}

export interface BomAreaRow {
  id: string;
  group: string; // "Bộ phận"
  label: string; // "Chi tiết" — "Khoang N" (body bands), "Đáy", "Nắp"
  areaM2: number;
}

// `sections[0]`/`sections.at(-1)` for the mouth/base cap flags, `samples`
// (dense (radius, z) curve) for the actual body-shape integral — same two
// inputs drawingInput's own Round branch already reuses elsewhere.
export function buildAreaBom(
  samples: Sample[],
  mouthCap: boolean,
  baseCap: boolean,
  material: MaterialInput,
  handle: HandleInput,
  lid: { mode?: "none" | "flat" | "cover"; diameter?: number; height?: number; bottomDiameter?: number },
  mouthRadiusMm: number,
  baseRadiusMm: number,
): BomAreaRow[] {
  const mouthZ = samples[0][1];
  const baseZ = samples[samples.length - 1][1];
  const splits = [...material.splits].filter((z) => z > baseZ && z < mouthZ).sort((a, b) => a - b);
  const bounds = [baseZ, ...splits, mouthZ];
  const rows: BomAreaRow[] = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const zLow = bounds[i];
    const zHigh = bounds[i + 1];
    const gross = frustumLateralAreaMm2(samples, zLow, zHigh);
    const cutout = cutoutAreaMm2InRange(samples, handle, zLow, zHigh);
    const net = Math.max(gross - cutout, 0);
    rows.push({ id: `area-body-${i}`, group: "Thân", label: `Khoang ${bounds.length - 1 - i}`, areaM2: net / 1_000_000 });
  }

  if (mouthCap) rows.push({ id: "area-mouth", group: "Thân", label: "Miệng", areaM2: (Math.PI * mouthRadiusMm * mouthRadiusMm) / 1_000_000 });
  if (baseCap) rows.push({ id: "area-base", group: "Đáy", label: "Đáy", areaM2: (Math.PI * baseRadiusMm * baseRadiusMm) / 1_000_000 });

  const lidMode = lid.mode ?? "none";
  if (lidMode !== "none") {
    const rTop = Math.max(lid.diameter ?? mouthRadiusMm * 2, 0.4) / 2;
    let areaMm2: number;
    if (lidMode === "flat") {
      areaMm2 = Math.PI * rTop * rTop;
    } else {
      const rBottom = Math.max(lid.bottomDiameter ?? rTop * 2, 0.4) / 2;
      const h = Math.max(lid.height ?? 60, 0);
      const slant = Math.sqrt((rTop - rBottom) ** 2 + h * h);
      areaMm2 = Math.PI * (rTop + rBottom) * slant + Math.PI * rTop * rTop;
    }
    rows.push({ id: "area-lid", group: "Nắp", label: "Nắp", areaM2: areaMm2 / 1_000_000 });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Square/Rectangle, Oval, Ellipse — no Ruby reference exists for these (the
// original ANASU calculate_engine.rb is Round-only), so this is a from-
// scratch generalization: same frustum-lateral-area INTEGRATION idea as
// Round's own frustumLateralAreaMm2 above, but driven by each shape's own
// PERIMETER (instead of a circle's circumference) at each Z, via an
// "equivalent radius" r = perimeter/(2π) standing in for the real radius in
// the slant-distance term. This reduces to the exact Round formula whenever
// perimeterAt IS a circle's circumference (same identity used to unify
// Rect's and Oval's own perimeter formula below), and is the standard
// reasonable approximation elsewhere, since a true closed-form lateral area
// between two differently-shaped rounded-rect/ellipse cross-sections has no
// general exact solution. The cutout handle's removed area is a flat
// rectangular notch (not an arc-chord like Round's) — genuinely correct
// here, since handlePaths for these shapes cut a literal straight-sided
// window in local chord coordinates (see rectHandlePaths.ts/
// ovalHandlePaths.ts/ellipseHandlePaths.ts), not an arc on a circle.
interface GenericDims {
  length: number;
  width: number;
  // Opaque 3rd shape parameter — corner radius for Rect/Square (varies per Z
  // the same way length/width do), ignored by Oval/Ellipse's own perimeter
  // functions (Oval's is always width/2, Ellipse has no corner concept).
  extra?: number;
}

function genericFrustumAreaMm2(
  zLow: number,
  zHigh: number,
  dimsAtZ: (z: number) => GenericDims,
  perimeterAt: (length: number, width: number, extra?: number) => number,
): number {
  const heightMm = zHigh - zLow;
  if (heightMm <= 0) return 0;
  const steps = Math.max(2, Math.round(heightMm / 4));
  let area = 0;
  for (let i = 0; i < steps; i++) {
    const z1 = zHigh - (heightMm * i) / steps;
    const z2 = zHigh - (heightMm * (i + 1)) / steps;
    const d1 = dimsAtZ(z1);
    const d2 = dimsAtZ(z2);
    const p1 = perimeterAt(d1.length, d1.width, d1.extra);
    const p2 = perimeterAt(d2.length, d2.width, d2.extra);
    const r1 = p1 / (2 * Math.PI);
    const r2 = p2 / (2 * Math.PI);
    const slant = Math.sqrt((r1 - r2) ** 2 + (z1 - z2) ** 2);
    area += ((p1 + p2) / 2) * slant;
  }
  return area;
}

function genericCutoutAreaMm2InRange(mouthZ: number, handle: HandleInput, zLow: number, zHigh: number): number {
  if (handle.type !== "cutout") return 0;
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const width = Math.max(handle.cutoutWidth, 10);
  const cutTop = mouthZ - offset;
  const cutBottom = cutTop - depth;
  const top = Math.min(cutTop, zHigh);
  const bottom = Math.max(cutBottom, zLow);
  if (top <= bottom) return 0;
  return width * (top - bottom) * 2; // flat notch, both sides (see handlePaths comment above)
}

interface GenericLidDims {
  mode?: "none" | "flat" | "cover";
  height?: number;
  length?: number;
  width?: number;
  bottomLength?: number;
  bottomWidth?: number;
}

function buildAreaBomGeneric(
  mouthZ: number,
  baseZ: number,
  mouthCap: boolean,
  baseCap: boolean,
  material: MaterialInput,
  handle: HandleInput,
  lid: GenericLidDims,
  dimsAtZ: (z: number) => GenericDims,
  perimeterAt: (length: number, width: number, extra?: number) => number,
  capAreaAt: (length: number, width: number, extra?: number) => number,
): BomAreaRow[] {
  const splits = [...material.splits].filter((z) => z > baseZ && z < mouthZ).sort((a, b) => a - b);
  const bounds = [baseZ, ...splits, mouthZ];
  const rows: BomAreaRow[] = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const zLow = bounds[i];
    const zHigh = bounds[i + 1];
    const gross = genericFrustumAreaMm2(zLow, zHigh, dimsAtZ, perimeterAt);
    const cutout = genericCutoutAreaMm2InRange(mouthZ, handle, zLow, zHigh);
    const net = Math.max(gross - cutout, 0);
    rows.push({ id: `area-body-${i}`, group: "Thân", label: `Khoang ${bounds.length - 1 - i}`, areaM2: net / 1_000_000 });
  }

  if (mouthCap) {
    const d = dimsAtZ(mouthZ);
    rows.push({ id: "area-mouth", group: "Thân", label: "Miệng", areaM2: capAreaAt(d.length, d.width, d.extra) / 1_000_000 });
  }
  if (baseCap) {
    const d = dimsAtZ(baseZ);
    rows.push({ id: "area-base", group: "Đáy", label: "Đáy", areaM2: capAreaAt(d.length, d.width, d.extra) / 1_000_000 });
  }

  const lidMode = lid.mode ?? "none";
  if (lidMode !== "none") {
    const mouthDims = dimsAtZ(mouthZ);
    let areaMm2: number;
    if (lidMode === "flat") {
      areaMm2 = capAreaAt(lid.length ?? mouthDims.length, lid.width ?? mouthDims.width, mouthDims.extra);
    } else {
      const topLength = lid.length ?? mouthDims.length;
      const topWidth = lid.width ?? mouthDims.width;
      const bottomLength = lid.bottomLength ?? topLength;
      const bottomWidth = lid.bottomWidth ?? topWidth;
      const h = Math.max(lid.height ?? 60, 0);
      const pTop = perimeterAt(topLength, topWidth, mouthDims.extra);
      const pBottom = perimeterAt(bottomLength, bottomWidth, mouthDims.extra);
      const rTop = pTop / (2 * Math.PI);
      const rBottom = pBottom / (2 * Math.PI);
      const slant = Math.sqrt((rTop - rBottom) ** 2 + h * h);
      areaMm2 = ((pTop + pBottom) / 2) * slant + capAreaAt(topLength, topWidth, mouthDims.extra);
    }
    rows.push({ id: "area-lid", group: "Nắp", label: "Nắp", areaM2: areaMm2 / 1_000_000 });
  }

  return rows;
}

// Rounded-rect perimeter/area (r = corner radius, clamped to the smaller
// half-extent). Oval reuses this exact pair with r = width/2 always (a
// "stadium" IS a rounded rect whose corner radius consumes the entire
// short side — see ovalFrameEngine.ts's own ringPoints3D, which draws it
// via this app's SAME buildRoundedRectPoints2D(length, width, width/2,…)).
// Verified algebraically to reduce to the textbook stadium
// perimeter/area formulas at r = width/2.
export function roundedRectPerimeterMm(length: number, width: number, cornerR: number): number {
  const r = Math.max(0, Math.min(cornerR, length / 2, width / 2));
  return 2 * (length - 2 * r) + 2 * (width - 2 * r) + 2 * Math.PI * r;
}
export function roundedRectAreaMm2(length: number, width: number, cornerR: number): number {
  const r = Math.max(0, Math.min(cornerR, length / 2, width / 2));
  return length * width - (4 - Math.PI) * r * r;
}

// True ellipse perimeter has no closed form — Ramanujan's 2nd approximation
// (relative error well under 1e-4 for any realistic length/width ratio).
export function ellipsePerimeterMm(length: number, width: number): number {
  const a = length / 2;
  const b = width / 2;
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}
export function ellipseAreaMm2(length: number, width: number): number {
  return Math.PI * (length / 2) * (width / 2);
}

// Rect/Square: body is a plain straight taper mouth→base (horizontalRings
// are structural rib markers only, not shape-altering control points — see
// rectProfileEngine.ts's own interpolateRectCorner, which this calls
// directly), so no dense sample array is needed — genericFrustumAreaMm2
// just re-interpolates at whatever fine Z steps it wants.
export function buildRectAreaBom(
  mouth: { z: number; length: number; width: number; cornerR: number; cap?: boolean },
  base: { z: number; length: number; width: number; cornerR: number; cap?: boolean },
  material: MaterialInput,
  handle: HandleInput,
  lid: GenericLidDims,
): BomAreaRow[] {
  const dimsAtZ = (z: number): GenericDims => {
    const t = Math.max(0, Math.min(1, (mouth.z - z) / (mouth.z - base.z || 1)));
    return {
      length: mouth.length + (base.length - mouth.length) * t,
      width: mouth.width + (base.width - mouth.width) * t,
      extra: mouth.cornerR + (base.cornerR - mouth.cornerR) * t,
    };
  };
  return buildAreaBomGeneric(
    mouth.z,
    base.z,
    !!mouth.cap,
    !!base.cap,
    material,
    handle,
    lid,
    dimsAtZ,
    (length, width, cornerR) => roundedRectPerimeterMm(length, width, cornerR ?? 0),
    (length, width, cornerR) => roundedRectAreaMm2(length, width, cornerR ?? 0),
  );
}

export function buildOvalAreaBom(
  samples: Array<[number, number, number]>,
  dimsAtZ: (z: number) => { length: number; width: number },
  mouthCap: boolean,
  baseCap: boolean,
  material: MaterialInput,
  handle: HandleInput,
  lid: GenericLidDims,
): BomAreaRow[] {
  const mouthZ = samples[0][2];
  const baseZ = samples[samples.length - 1][2];
  return buildAreaBomGeneric(mouthZ, baseZ, mouthCap, baseCap, material, handle, lid, dimsAtZ, (l, w) => roundedRectPerimeterMm(l, w, w / 2), (l, w) =>
    roundedRectAreaMm2(l, w, w / 2),
  );
}

export function buildEllipseAreaBom(
  samples: Array<[number, number, number]>,
  dimsAtZ: (z: number) => { length: number; width: number },
  mouthCap: boolean,
  baseCap: boolean,
  material: MaterialInput,
  handle: HandleInput,
  lid: GenericLidDims,
): BomAreaRow[] {
  const mouthZ = samples[0][2];
  const baseZ = samples[samples.length - 1][2];
  return buildAreaBomGeneric(mouthZ, baseZ, mouthCap, baseCap, material, handle, lid, dimsAtZ, ellipsePerimeterMm, ellipseAreaMm2);
}
