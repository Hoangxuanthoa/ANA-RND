// 2D technical-drawing data for Front/Side/Top/Iso views — shape-agnostic.
// Computed directly from the same profile math as each shape's own 3D view
// (its dense Z→(length,width) samples), not from a screenshot/projection of
// the 3D mesh — so dimensions always match the parametric input exactly.
//
// Originally written for Round alone (a pure revolve: one radius per Z).
// Generalized so Square/Rectangle/Oval/Ellipse can reuse the SAME view
// builders: every shape now feeds in a `ShapeDrawingInput` — a dense list of
// (halfLengthMm, halfWidthMm, zMm) rows (mouth→base) plus a sparse list of
// labeled rings for dimension callouts, plus its own 2D cross-section outline
// function. Front reads each row's halfLengthMm, Side reads halfWidthMm —
// identical for Round (halfLength = halfWidth = radius everywhere), which is
// what keeps this a pure generalization rather than a behavior change for
// the shape it was built for.
import { clamp, sampleSliceBetweenZ, type Sample } from "./math";
import type { FrameTube } from "./frameEngine";

// Ring identity is positional, same convention every shape's own profile
// form already uses (RoundProfileForm/OvalProfileForm/EllipseProfileForm's
// own local ringLabel) — shared here so page.tsx's drawing-input adapters
// don't each re-implement the identical 3 lines.
export function ringLabel(index: number, total: number): string {
  if (index === 0) return "Miệng";
  if (index === total - 1) return "Đáy";
  return `Vòng ngang ${index}`;
}

// One dense profile row — the shape's own extent at this Z. `cornerRMm` is
// only meaningful for Rectangle/Square (an independently-set corner radius,
// not derivable from length/width alone); every other shape's own
// `outline2D` ignores it.
export interface ShapeDrawingRow {
  zMm: number;
  halfLengthMm: number;
  halfWidthMm: number;
  cornerRMm: number;
}

// One labeled ring (Miệng / Vòng ngang N / Đáy) for dimension callouts — a
// real user-entered control point, not every dense sample.
export interface ShapeDrawingRing {
  zMm: number;
  label: string;
  lengthMm: number;
  widthMm: number;
}

export interface ShapeDrawingInput {
  // Dense, sorted mouth (rows[0]) → base (rows[last]) — the same curve the
  // shape's own 3D Solid lofts through (denseSamples when Khóa dáng is
  // active, so the drawing always matches the 3D view exactly).
  rows: ShapeDrawingRow[];
  rings: ShapeDrawingRing[];
  // This shape's own 2D cross-section at an arbitrary (length, width) —
  // buildRoundedRectPoints2D for Square/Rectangle/Oval, ellipsePoints2D for
  // Ellipse, a plain circle for Round (ignoring width/cornerR, since a
  // round row always has length = width = diameter by construction).
  outline2D: (lengthMm: number, widthMm: number, cornerRMm: number, segments?: number) => Array<[number, number]>;
  // Round only: switches dimension labels to "Ø294" instead of a plain
  // number, and lets Front/Side share one set of ring callouts instead of
  // each needing their own (a round cross-section has no separate
  // length/width to show).
  isRound: boolean;
}

function rowHalf(row: ShapeDrawingRow, axis: "length" | "width"): number {
  return axis === "length" ? row.halfLengthMm : row.halfWidthMm;
}

function ringFull(ring: ShapeDrawingRing, axis: "length" | "width"): number {
  return axis === "length" ? ring.lengthMm : ring.widthMm;
}

// Linearly interpolates a full row (all 3 fields) at an arbitrary Z from the
// dense `rows` — same convention as math.ts's own radiusAtZ, generalized to
// 3 values at once, needed wherever a Z range's own boundary (e.g. a
// material khoang split) doesn't land exactly on an existing dense sample.
export function rowAtZ(rows: ShapeDrawingRow[], z: number): ShapeDrawingRow {
  if (!rows.length) return { zMm: z, halfLengthMm: 0, halfWidthMm: 0, cornerRMm: 0 };
  if (z >= rows[0].zMm) return rows[0];
  const last = rows[rows.length - 1];
  if (z <= last.zMm) return last;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (z <= a.zMm + 0.001 && z >= b.zMm - 0.001) {
      const dz = b.zMm - a.zMm;
      const t = clamp(Math.abs(dz) < 0.001 ? 0 : (z - a.zMm) / dz, 0, 1);
      return {
        zMm: z,
        halfLengthMm: a.halfLengthMm + (b.halfLengthMm - a.halfLengthMm) * t,
        halfWidthMm: a.halfWidthMm + (b.halfWidthMm - a.halfWidthMm) * t,
        cornerRMm: a.cornerRMm + (b.cornerRMm - a.cornerRMm) * t,
      };
    }
  }
  return last;
}

export interface RingDimension {
  zMm: number;
  radiusMm: number;
  diameterMm: number;
  label: string;
}

export interface AxisViewData {
  // Closed silhouette polygon (x, z) in mm, right side top→bottom then
  // mirrored left side bottom→top — a plain "extruded along Z" silhouette
  // (an exact revolve for Round; for other shapes, the boundary this axis
  // actually has — length for Front, width for Side).
  outline: Array<[number, number]>;
  rings: RingDimension[];
  minZ: number;
  maxZ: number;
  maxRadius: number;
  // The dense (half-extent, z) profile the outline above was built from
  // (mouth → bottom) — exposed so a caller can slice it into material-khoang
  // bands (see TechnicalDrawing.tsx's MaterialBandFills) the same way the 3D
  // Solid view does, instead of re-deriving it and risking drift.
  samples: Sample[];
}

function buildAxisViewData(input: ShapeDrawingInput, axis: "length" | "width"): AxisViewData {
  const samples: Sample[] = input.rows.map((r) => [rowHalf(r, axis), r.zMm]);
  const right: Array<[number, number]> = samples.map(([r, z]) => [r, z]);
  const left: Array<[number, number]> = [...samples].reverse().map(([r, z]) => [-r, z]);
  const outline = [...right, ...left];

  const rings: RingDimension[] = input.rings.map((r) => {
    const full = ringFull(r, axis);
    return { zMm: r.zMm, radiusMm: full / 2, diameterMm: full, label: r.label };
  });

  const maxRadius = samples.reduce((m, [r]) => Math.max(m, r), 0);
  const maxZ = input.rows[0].zMm;
  const minZ = input.rows[input.rows.length - 1].zMm;

  return { outline, rings, minZ, maxZ, maxRadius, samples };
}

// Front reads each row's LENGTH — the extent visible looking along Y.
export function buildFrontViewData(input: ShapeDrawingInput): AxisViewData {
  return buildAxisViewData(input, "length");
}

// Side reads each row's WIDTH — the extent visible looking along X. Genuine
// duplicate of Front for Round (halfLength = halfWidth everywhere), which is
// exactly why Round's own dimension callouts stay Front-only (see
// TechnicalDrawing.tsx) — Square/Rectangle/Oval/Ellipse get their own
// distinct Side outline and their own callouts here.
export function buildSideViewData(input: ShapeDrawingInput): AxisViewData {
  return buildAxisViewData(input, "width");
}

// Same right-then-mirrored-left construction as buildAxisViewData's own
// `outline`, just Z-bounded to [zLow, zHigh] — used to draw one material
// khoang's own silhouette band (see TechnicalDrawing.tsx's
// MaterialBandFills) instead of the whole-body outline.
export function sliceOutline(samples: Sample[], zLow: number, zHigh: number): Array<[number, number]> {
  const slice = sampleSliceBetweenZ(samples, zLow, zHigh);
  const right: Array<[number, number]> = slice.map(([r, z]) => [r, z]);
  const left: Array<[number, number]> = [...slice].reverse().map(([r, z]) => [-r, z]);
  return [...right, ...left];
}

export interface TopViewData {
  maxRadius: number; // widest point's own larger half-extent — for auto-fit sizing (kept name for call-site compat)
  mouthOutline: Array<[number, number]>;
  bottomOutline: Array<[number, number]>;
  // The row with the largest half-extent's own outline — the true visible
  // outer silhouette from above (was a single `maxRadius` circle for Round;
  // generalized since a bulging middle ring can have a different
  // length:width ratio than either endpoint).
  maxOutline: Array<[number, number]>;
  mouthIsWidest: boolean; // avoids drawing a duplicate outline when the mouth IS the widest point
}

const TOP_SEGMENTS = 64;

export function buildTopViewData(input: ShapeDrawingInput, segments = TOP_SEGMENTS): TopViewData {
  const mouthRow = input.rows[0];
  const bottomRow = input.rows[input.rows.length - 1];
  const widestRow = input.rows.reduce((a, b) => (Math.max(b.halfLengthMm, b.halfWidthMm) > Math.max(a.halfLengthMm, a.halfWidthMm) ? b : a));

  const mouthOutline = input.outline2D(mouthRow.halfLengthMm * 2, mouthRow.halfWidthMm * 2, mouthRow.cornerRMm, segments);
  const bottomOutline = input.outline2D(bottomRow.halfLengthMm * 2, bottomRow.halfWidthMm * 2, bottomRow.cornerRMm, segments);
  const maxOutline = input.outline2D(widestRow.halfLengthMm * 2, widestRow.halfWidthMm * 2, widestRow.cornerRMm, segments);

  const mouthIsWidest = Math.abs(mouthRow.halfLengthMm - widestRow.halfLengthMm) < 0.5 && Math.abs(mouthRow.halfWidthMm - widestRow.halfWidthMm) < 0.5;
  const maxRadius = Math.max(widestRow.halfLengthMm, widestRow.halfWidthMm);

  return { maxRadius, mouthOutline, bottomOutline, maxOutline, mouthIsWidest };
}

// Parallel projection constants for a Z-up model. A true isometric camera
// uses a 30° ground-plane angle, which read as "too high" (too much of the
// top visible) — lowered to 22° for a flatter, more side-on camera.
const ISO_ANGLE = (22 * Math.PI) / 180;
const ISO_COS = Math.cos(ISO_ANGLE);
const ISO_SIN = Math.sin(ISO_ANGLE);

function isoProject(x: number, y: number, z: number): [number, number] {
  return [(x - y) * ISO_COS, (x + y) * ISO_SIN - z];
}

// The visible LEFT/RIGHT silhouette edge of a body in this projection is
// wherever its cross-section's own boundary projects furthest to that side
// — NOT simply its "front-most" or "side-most" point (a circle's own
// silhouette tangent point sits at 45°, not 0°/90° — see the numeric
// verification this replaces below). Taking the true max/min of (x−y) over
// each row's OWN outline is what makes this correct for any shape, and it
// provably reduces to Round's old exact shortcut in the process: on a
// circle of radius r, x−y = r·(cosθ−sinθ) = r√2·cos(θ+45°), maximized at
// θ=−45° giving max(x−y) = r√2, i.e. screen-X = r√2·cos(22°) — exactly the
// old `radius · cos(22°) · √2` constant this used to hardcode as a
// circle-only identity, now just what falls out of scanning the real
// outline for any shape.
const ISO_SEGMENTS = 96;

function isoSilhouetteExtremesAtRow(input: ShapeDrawingInput, row: ShapeDrawingRow, segments: number): { right: [number, number]; left: [number, number] } {
  const pts2D = input.outline2D(row.halfLengthMm * 2, row.halfWidthMm * 2, row.cornerRMm, segments);
  let right: [number, number] = isoProject(row.halfLengthMm, 0, row.zMm);
  let left: [number, number] = isoProject(-row.halfLengthMm, 0, row.zMm);
  let rightX = -Infinity;
  let leftX = Infinity;
  for (const [x, y] of pts2D) {
    const p = isoProject(x, y, row.zMm);
    if (p[0] > rightX) {
      rightX = p[0];
      right = p;
    }
    if (p[0] < leftX) {
      leftX = p[0];
      left = p;
    }
  }
  return { right, left };
}

export interface IsoViewData {
  outline: Array<[number, number]>; // outer silhouette, iso-projected
  mouthEllipse: Array<[number, number]>; // rim — drawn solid (visible, open top)
  bottomEllipse: Array<[number, number]>; // drawn dashed (hidden under the walls)
  minZ: number;
  maxZ: number;
  maxRadius: number;
  rows: ShapeDrawingRow[];
}

export function buildIsoViewData(input: ShapeDrawingInput, rimSegments = TOP_SEGMENTS, silhouetteSegments = ISO_SEGMENTS): IsoViewData {
  const rightPts: Array<[number, number]> = [];
  const leftPts: Array<[number, number]> = [];
  for (const row of input.rows) {
    const { right, left } = isoSilhouetteExtremesAtRow(input, row, silhouetteSegments);
    rightPts.push(right);
    leftPts.push(left);
  }
  const outline = [...rightPts, ...[...leftPts].reverse()];

  const mouth = input.rows[0];
  const bottom = input.rows[input.rows.length - 1];
  const mouthEllipse = input.outline2D(mouth.halfLengthMm * 2, mouth.halfWidthMm * 2, mouth.cornerRMm, rimSegments).map(([x, y]) => isoProject(x, y, mouth.zMm));
  const bottomEllipse = input.outline2D(bottom.halfLengthMm * 2, bottom.halfWidthMm * 2, bottom.cornerRMm, rimSegments).map(([x, y]) => isoProject(x, y, bottom.zMm));

  const maxRadius = input.rows.reduce((m, r) => Math.max(m, r.halfLengthMm, r.halfWidthMm), 0);
  return { outline, mouthEllipse, bottomEllipse, minZ: bottom.zMm, maxZ: mouth.zMm, maxRadius, rows: input.rows };
}

// Same [x, z] → iso-projected transform `outline` above is built with,
// restricted to one material khoang's own Z range — used by
// TechnicalDrawing.tsx's MaterialBandFills when reused for Iso, so a split
// band's own outline is genuinely re-derived from the shape's real
// silhouette in that range rather than a whole-body shortcut.
export function sliceIsoOutline(input: ShapeDrawingInput, zLow: number, zHigh: number, silhouetteSegments = ISO_SEGMENTS): Array<[number, number]> {
  const inside = input.rows.filter((r) => r.zMm <= zHigh && r.zMm >= zLow);
  const rows: ShapeDrawingRow[] = [];
  if (inside.length === 0 || inside[0].zMm < zHigh) rows.push(rowAtZ(input.rows, zHigh));
  rows.push(...inside);
  if (inside.length === 0 || inside[inside.length - 1].zMm > zLow) rows.push(rowAtZ(input.rows, zLow));

  const rightPts: Array<[number, number]> = [];
  const leftPts: Array<[number, number]> = [];
  for (const row of rows) {
    const { right, left } = isoSilhouetteExtremesAtRow(input, row, silhouetteSegments);
    rightPts.push(right);
    leftPts.push(left);
  }
  return [...rightPts, ...[...leftPts].reverse()];
}

// Wireframe projections of the actual steel-frame member centerlines — used
// when the sheet is set to "Khung sắt" instead of "Solid". Each tube's
// polyline is projected independently (no silhouette/hidden-line solving),
// which is the right amount of correctness for a construction reference
// drawing: every rib/ring/spoke is visible, same as looking at a wireframe.
export type Polyline = Array<[number, number]>;

// Ring/spoke-circle tubes are built as CLOSED loops in 3D (buildTubeGeometry
// with {closed:true} — no seam in the swept mesh). Their raw `points` array
// is still just the open list fed into that sweep, so a 2D wireframe drawn
// straight from `points` would show a gap at the seam between the last and
// first point. Re-closing here (once, before every projection) keeps that
// in sync automatically.
function loopPoints(t: FrameTube): FrameTube["points"] {
  return t.closed && t.points.length ? [...t.points, t.points[0]] : t.points;
}

// Each wireframe segment carries its own real FI (diameter) so it can be
// drawn at true thickness — a stroke-width equal to the tube's actual mm
// diameter, exactly like a "double-line" pipe/rod convention in a real
// fabrication drawing, not an abstract centerline. This is exact (not an
// approximation) for members lying flat in the view plane — verticals in
// Front/Side, spokes/rings in Top — which is every member here; only a
// tube angled steeply toward the viewer would foreshorten, and none do.
export interface WireSegment {
  points: Polyline;
  diameterMm: number;
}

export function projectTubesFront(tubes: FrameTube[]): WireSegment[] {
  return tubes.map((t) => ({ points: loopPoints(t).map((p): [number, number] => [p.x, p.z]), diameterMm: t.diameterMm }));
}

// Standing handles are mounted at X=±mouthRadius (or, for Rectangle with
// handle.side==="length", at Y=±mouthHalfWidth instead) and arc across the
// OTHER axis — dropping that other axis (Front, for the common X-mount
// case) collapses each handle to a vertical sliver at its mount point,
// while dropping the mount axis (Side) shows its true arc shape. That's why
// Front and Side genuinely need separate projections for a handle-bearing
// product, not just a relabelled copy of the same view.
export function projectTubesSide(tubes: FrameTube[]): WireSegment[] {
  return tubes.map((t) => ({ points: loopPoints(t).map((p): [number, number] => [p.y, p.z]), diameterMm: t.diameterMm }));
}

export function projectTubesTop(tubes: FrameTube[]): WireSegment[] {
  return tubes.map((t) => ({ points: loopPoints(t).map((p): [number, number] => [p.x, -p.y]), diameterMm: t.diameterMm }));
}

export function projectTubesIso(tubes: FrameTube[]): WireSegment[] {
  return tubes.map((t) => ({ points: loopPoints(t).map((p) => isoProject(p.x, p.y, p.z)), diameterMm: t.diameterMm }));
}

// Same idea, but for raw handle centerline paths (Solid mode draws the
// handle as a thin guide line, same as the 3D Solid viewport, rather than
// a swept steel tube).
type Point3 = { x: number; y: number; z: number };

export function projectPathsFront(paths: Point3[][]): Polyline[] {
  return paths.map((pts) => pts.map((p): [number, number] => [p.x, p.z]));
}

export function projectPathsSide(paths: Point3[][]): Polyline[] {
  return paths.map((pts) => pts.map((p): [number, number] => [p.y, p.z]));
}

export function projectPathsIso(paths: Point3[][]): Polyline[] {
  return paths.map((pts) => pts.map((p) => isoProject(p.x, p.y, p.z)));
}
