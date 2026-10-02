// Ellipse Solid: unlike Oval, this is NOT a thin adapter onto Rectangle's
// engine — a true ellipse (x/a)² + (y/b)² = 1 has no straight sides at
// all, so Rectangle's rounded-corner math (which always keeps 2 flat
// edges unless the corner radius fully consumes them, and even then only
// produces a stadium, not a smooth ellipse) doesn't apply here. Only the
// truly SHAPE-AGNOSTIC pieces are reused: buildRectBodyGeometry (a plain
// loft between 2 point rows, generalized below into a multi-row loft) and
// buildRectCapGeometry (a fan triangulation from a center vertex) — neither
// reads cornerR, they just take whatever 2D points they're given.
//
// The body now lofts through a DENSE profile built from however many rings
// the user enters, each independently bowed ("Lồi"/"Lõm") between its
// neighbors — same idea as Oval's own port (see ovalProfileEngine.ts's own
// comment for the full rationale, including why the dense curve is built
// by running Round's REAL Hermite/bow engine twice — once per axis —
// rather than a from-scratch bow formula).
import * as THREE from "three";
import { clamp, lerp, num, radiusAtZ } from "./math";
import { buildRectBodyGeometry, buildRectCapGeometry } from "./rectProfileEngine";
import { buildProfileSamples, normalizeRings } from "./profileEngine";
import { DEFAULT_HANDLE } from "./types";
import type { EllipseCorner, EllipseProfileInput, EllipseRingInput, HandleInput, LidInput, RingInput } from "./types";
import type { LidGeometry, SolidLike } from "./profileEngine";

export const DEFAULT_ELLIPSE_SEGMENTS = 64;
const EPSILON = 0.001;
const MIN_EXTENT_MM = 1;

// A normalized ring, resolved to real numbers — like ovalProfileEngine.ts's
// own OvalSection.
export interface EllipseSection {
  zMm: number;
  lengthMm: number;
  widthMm: number;
  cap: boolean;
}

// [lengthMm, widthMm, zMm] — same convention as OvalSample.
export type EllipseSample = [number, number, number];

export function normalizeEllipseRings(rings: EllipseRingInput[]): EllipseSection[] {
  const sections = rings.map((r) => ({
    zMm: num(r.z, 0),
    lengthMm: Math.max(num(r.length, 100), MIN_EXTENT_MM),
    widthMm: Math.max(num(r.width, 100), MIN_EXTENT_MM),
    cap: !!r.cap,
  }));
  return sections.sort((a, b) => b.zMm - a.zMm);
}

export function validateEllipseSections(sections: EllipseSection[]): void {
  for (let i = 0; i < sections.length - 1; i++) {
    if (Math.abs(sections[i].zMm - sections[i + 1].zMm) < EPSILON) {
      throw new Error("Hai vòng ngang không được trùng vị trí Z.");
    }
  }
}

function toRingInputs(rings: EllipseRingInput[], axis: "length" | "width"): RingInput[] {
  return rings.map((r) => ({ z: r.z, diameter: axis === "length" ? r.length : r.width, transition: r.transition, curveDepth: r.curveDepth, cap: r.cap }));
}

// Builds the dense bowed profile by running Round's OWN Hermite/bow engine
// (profileEngine.ts's normalizeRings + buildProfileSamples) TWICE — once
// treating length as the "diameter", once width — then resamples the width
// curve onto the length curve's own Z grid via radiusAtZ. See
// ovalProfileEngine.ts's buildOvalProfileSamples for the full rationale.
export function buildEllipseProfileSamples(rings: EllipseRingInput[]): EllipseSample[] {
  const lengthSamples = buildProfileSamples(normalizeRings(toRingInputs(rings, "length")));
  const widthSamples = buildProfileSamples(normalizeRings(toRingInputs(rings, "width")));
  return lengthSamples.map(([halfLength, z]) => [halfLength * 2, radiusAtZ(widthSamples, z) * 2, z]);
}

// (length, width) at an arbitrary Z, interpolated along the dense bowed
// profile — same role as ovalProfileEngine.ts's ovalDimsAtZ.
export function ellipseDimsAtZ(samples: EllipseSample[], z: number): { length: number; width: number } {
  if (!samples.length) return { length: 0, width: 0 };
  if (z >= samples[0][2]) return { length: samples[0][0], width: samples[0][1] };
  const last = samples[samples.length - 1];
  if (z <= last[2]) return { length: last[0], width: last[1] };
  for (let i = 0; i < samples.length - 1; i++) {
    const [pl, pw, pz] = samples[i];
    const [ql, qw, qz] = samples[i + 1];
    if (z <= pz + EPSILON && z >= qz - EPSILON) {
      const dz = qz - pz;
      const t = clamp(Math.abs(dz) < EPSILON ? 0 : (z - pz) / dz, 0, 1);
      return { length: lerp(pl, ql, t), width: lerp(pw, qw, t) };
    }
  }
  return { length: last[0], width: last[1] };
}

// Ellipse boundary in the XY plane (X = "chiều dài" / semi-major a,
// Y = "chiều rộng" / semi-minor b), centered at the origin, starting at
// the +X vertex and going counter-clockwise, by uniform ANGLE step — fine
// for a ring/cap/body outline's own rendering resolution (same convention
// Round's own circlePoints uses); rib/handle placement below needs true
// arc-length spacing instead, see halfPerimeterPoint.
export function ellipsePoints2D(length: number, width: number, segments = DEFAULT_ELLIPSE_SEGMENTS): [number, number][] {
  const a = Math.max(length, 0.001) / 2;
  const b = Math.max(width, 0.001) / 2;
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    points.push([a * Math.cos(theta), b * Math.sin(theta)]);
  }
  return points;
}

// A true ellipse's arc length has no elementary closed form — this
// numerically tabulates cumulative arc length over ONE quarter
// (θ: 0..π/2, the +X vertex to the +Y vertex), finely sampled, so a
// "point at fractional arc length" query can look it up by linear
// interpolation. The other 3 quarters are exact mirrors (an ellipse
// centered at the origin, axis-aligned, is symmetric across both axes),
// so only this one needs building.
interface ArcTable {
  thetas: number[];
  cum: number[];
  total: number;
}

function buildQuarterArcTable(a: number, b: number, steps = 180): ArcTable {
  const thetas: number[] = [0];
  const cum: number[] = [0];
  let prev: [number, number] = [a, 0];
  for (let i = 1; i <= steps; i++) {
    const theta = (Math.PI / 2) * (i / steps);
    const pt: [number, number] = [a * Math.cos(theta), b * Math.sin(theta)];
    cum.push(cum[cum.length - 1] + Math.hypot(pt[0] - prev[0], pt[1] - prev[1]));
    thetas.push(theta);
    prev = pt;
  }
  return { thetas, cum, total: cum[cum.length - 1] };
}

function angleAtArcFraction(table: ArcTable, frac: number): number {
  const target = Math.max(0, Math.min(1, frac)) * table.total;
  const { cum, thetas } = table;
  if (target <= cum[0]) return thetas[0];
  for (let i = 1; i < cum.length; i++) {
    if (target <= cum[i]) {
      const segFrac = (target - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-9);
      return thetas[i - 1] + (thetas[i] - thetas[i - 1]) * segFrac;
    }
  }
  return thetas[thetas.length - 1];
}

// Point at fractional arc length t∈[0,1] along the "upper" half-perimeter
// — from the +X vertex (t=0, the point a standing handle mounts on — same
// role as ovalProfileEngine.ts's halfPerimeterPoint) through the true
// elliptical curve to the -X vertex (t=1). t∈[0,0.5] sweeps the +X→+Y
// quarter, t∈[0.5,1] sweeps the +Y→-X quarter (mirrored from the same
// table). The "lower" half is this same path mirrored (y → -y).
export function halfPerimeterPoint(length: number, width: number, t: number): [number, number] {
  const a = Math.max(length, 0.001) / 2;
  const b = Math.max(width, 0.001) / 2;
  const table = buildQuarterArcTable(a, b);
  const twoQuarters = Math.max(0, Math.min(1, t)) * 2;
  const theta = twoQuarters <= 1 ? angleAtArcFraction(table, twoQuarters) : Math.PI - angleAtArcFraction(table, 2 - twoQuarters);
  return [a * Math.cos(theta), b * Math.sin(theta)];
}

// 2 open strips, each running the "long way" around from just past one
// vertex's gap to just before the other vertex's gap — one along +Y, one
// along -Y — port of Round's cutoutSurfaceIntervals / Oval's own
// ovalGapIntervals, just walking the true elliptical arc length instead.
// gapHalfWidth (mm) is converted to an arc-length offset using the LOCAL
// radius of curvature at the vertex — b²/a, the standard "osculating
// circle" radius for an ellipse at (±a, 0) — the same chord-to-angle math
// Round/Oval already use for a handle's own base width, just fed the
// correct local radius for a genuinely curved (non-circular) boundary.
function ellipseGapIntervals(length: number, width: number, gapHalfWidth: number, segments: number): [number, number][][] {
  const a = Math.max(length, 0.001) / 2;
  const b = Math.max(width, 0.001) / 2;
  const rho = (b * b) / Math.max(a, 0.0001);
  const thetaGap = Math.asin(Math.min(Math.max(gapHalfWidth / Math.max(rho, 0.0001), 0), 0.999));
  const gapArc = rho * thetaGap;
  const table = buildQuarterArcTable(a, b);
  const halfTotal = table.total * 2;
  const tGap = Math.min(gapArc / Math.max(halfTotal, 0.0001), 0.49);

  function strip(sign: 1 | -1): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = tGap + (1 - 2 * tGap) * (i / segments);
      const [x, y] = halfPerimeterPoint(length, width, t);
      pts.push([x, sign * y]);
    }
    return pts;
  }
  return [strip(1), strip(-1)];
}

// Multi-row loft through the ENTIRE dense bowed profile — see
// ovalProfileEngine.ts's buildOvalBodyGeometry for the same idea, just with
// ellipsePoints2D as the row shape instead of a rounded rect.
function buildEllipseBodyGeometry(samples: EllipseSample[], segments: number): THREE.BufferGeometry {
  const rows = samples.map(([length, width, z]) => ({ z, pts: ellipsePoints2D(length, width, segments) }));
  const n = rows[0].pts.length;
  const positions: number[] = [];
  rows.forEach((row) => row.pts.forEach(([x, y]) => positions.push(x, y, row.z)));

  const indices: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + k;
      const c = (i + 1) * n + k;
      const d = (i + 1) * n + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Structural port of Round's own buildBodyGeometryWithCutout, now working
// off the FULL dense multi-ring profile (ellipseDimsAtZ) instead of just
// mouth/base — see ovalProfileEngine.ts's own port for the fuller
// rationale: outside the cutout's own Z band, every row-to-row strip is
// the FULL normal closed ellipse (no notch anywhere); only the band
// actually inside the opening uses ellipseGapIntervals, each quad pushed
// with its own fresh vertices so point counts never need to match between
// the two kinds of strip.
function buildEllipseBodyGeometryWithCutout(samples: EllipseSample[], handle: HandleInput, segments: number): THREE.BufferGeometry {
  const mouthZ = samples[0][2];
  const baseZ = samples[samples.length - 1][2];
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const gapHalfWidth = Math.max(handle.cutoutWidth, 10) / 2;
  const zTop = Math.min(mouthZ - offset, mouthZ);
  const zBottom = Math.max(zTop - depth, baseZ + 0.001);

  const zValues = [...samples.map((s) => s[2]), zTop, zBottom].sort((x, y) => y - x);
  const uniqueZ: number[] = [];
  for (const z of zValues) {
    if (uniqueZ.length === 0 || Math.abs(uniqueZ[uniqueZ.length - 1] - z) > EPSILON) uniqueZ.push(z);
  }
  const rows = uniqueZ.map((z) => ({ z, ...ellipseDimsAtZ(samples, z) }));

  const positions: number[] = [];
  const indices: number[] = [];
  let cursor = 0;
  function pushQuad(p00: [number, number, number], p01: [number, number, number], p11: [number, number, number], p10: [number, number, number]) {
    const b = cursor;
    positions.push(...p00, ...p01, ...p11, ...p10);
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    cursor += 4;
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const rowA = rows[i];
    const rowB = rows[i + 1];
    const zMid = (rowA.z + rowB.z) / 2;
    const inBand = zMid < zTop - EPSILON && zMid > zBottom + EPSILON;

    if (inBand) {
      const intervalsA = ellipseGapIntervals(rowA.length, rowA.width, gapHalfWidth, segments);
      const intervalsB = ellipseGapIntervals(rowB.length, rowB.width, gapHalfWidth, segments);
      intervalsA.forEach((ia, idx) => {
        const ib = intervalsB[idx];
        const n = Math.min(ia.length, ib.length);
        for (let k = 0; k < n - 1; k++) {
          pushQuad([ia[k][0], ia[k][1], rowA.z], [ia[k + 1][0], ia[k + 1][1], rowA.z], [ib[k + 1][0], ib[k + 1][1], rowB.z], [ib[k][0], ib[k][1], rowB.z]);
        }
      });
      continue;
    }

    const ptsA = ellipsePoints2D(rowA.length, rowA.width, segments);
    const ptsB = ellipsePoints2D(rowB.length, rowB.width, segments);
    const n = ptsA.length;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      pushQuad([ptsA[j][0], ptsA[j][1], rowA.z], [ptsA[k][0], ptsA[k][1], rowA.z], [ptsB[k][0], ptsB[k][1], rowB.z], [ptsB[j][0], ptsB[j][1], rowB.z]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Lid modes match Round/Rect/Oval: none / flat / cover. No cornerR concept
// here — an ellipse is smooth everywhere, there's nothing to round.
const ELLIPSE_LID_DEFAULT_OVERHANG_MM = 20;

function buildEllipseLidGeometry(mouth: EllipseCorner, lid: LidInput, segments = DEFAULT_ELLIPSE_SEGMENTS): LidGeometry {
  const mode = lid.mode || "none";
  if (mode === "none") return {};
  const topZ = mouth.z;
  const height = Math.max(num(lid.height, 60), 0);

  if (mode === "flat") {
    const length = Math.max(num(lid.length, mouth.length), 1);
    const width = Math.max(num(lid.width, mouth.width), 1);
    return { top: buildRectCapGeometry(ellipsePoints2D(length, width, segments), topZ + height) };
  }

  const length = Math.max(num(lid.length, mouth.length + ELLIPSE_LID_DEFAULT_OVERHANG_MM), 1);
  const width = Math.max(num(lid.width, mouth.width + ELLIPSE_LID_DEFAULT_OVERHANG_MM), 1);
  const bottomLength = Math.max(num(lid.bottomLength, mouth.length + ELLIPSE_LID_DEFAULT_OVERHANG_MM), 1);
  const bottomWidth = Math.max(num(lid.bottomWidth, mouth.width + ELLIPSE_LID_DEFAULT_OVERHANG_MM), 1);
  const lowerPts = ellipsePoints2D(bottomLength, bottomWidth, segments);
  const upperPts = ellipsePoints2D(length, width, segments);
  const skirt = buildRectBodyGeometry(lowerPts, topZ, upperPts, topZ + height);
  const top = buildRectCapGeometry(upperPts, topZ + height);
  return { skirt, top };
}

export interface EllipseSolidResult extends SolidLike {
  samples: EllipseSample[];
}

export function buildEllipseSolid(
  profile: EllipseProfileInput,
  lid: LidInput = {},
  handle: HandleInput = DEFAULT_HANDLE,
  segments = DEFAULT_ELLIPSE_SEGMENTS,
  // Optional dense (length, width, z) profile to loft the BODY from
  // instead of the rings' own bow curve — set while "Khóa dáng" is active,
  // same role as buildOvalSolid's own denseSamples param.
  denseSamples?: EllipseSample[],
): EllipseSolidResult {
  if (!profile.rings || profile.rings.length < 2) {
    throw new Error("Cần ít nhất 2 vòng để dựng hình.");
  }
  const sections = normalizeEllipseRings(profile.rings);
  validateEllipseSections(sections);
  const samples = denseSamples && denseSamples.length >= 2 ? denseSamples : buildEllipseProfileSamples(profile.rings);

  const body = handle.type === "cutout" ? buildEllipseBodyGeometryWithCutout(samples, handle, segments) : buildEllipseBodyGeometry(samples, segments);

  const mouthSection = sections[0];
  const baseSection = sections[sections.length - 1];
  const basePts = ellipsePoints2D(baseSection.lengthMm, baseSection.widthMm, segments);
  const bottomCap = baseSection.cap ? buildRectCapGeometry(basePts, baseSection.zMm) : undefined;
  const mouthCorner: EllipseCorner = { z: mouthSection.zMm, length: mouthSection.lengthMm, width: mouthSection.widthMm };

  return { body, bottomCap, lid: buildEllipseLidGeometry(mouthCorner, lid, segments), samples };
}
