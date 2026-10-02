// Oval Solid: a "stadium" shape (2 straight sides + 2 full semicircular end
// caps, radius = width/2) at every Z — reuses Rectangle's own
// buildRoundedRectPoints2D (already shape-general at cornerR = width/2) for
// each row's 2D outline, but — unlike the old model, which only ever had a
// mouth row and a base row lofted into one flat frustum — the body now
// lofts through a DENSE profile built from however many rings the user
// enters, each independently bowed ("Lồi"/"Lõm") between its neighbors,
// same as Round's own ring-to-ring bow. This is what actually lets an oval
// bulge a belly or waist, not just taper in a straight line.
import * as THREE from "three";
import { clamp, lerp, num, radiusAtZ } from "./math";
import { buildRectCapGeometry, buildRectLidGeometry, buildRoundedRectPoints2D, DEFAULT_RECT_SEGMENTS_PER_CORNER } from "./rectProfileEngine";
import { buildProfileSamples, normalizeRings } from "./profileEngine";
import { DEFAULT_HANDLE } from "./types";
import type { HandleInput, LidInput, OvalCorner, OvalProfileInput, OvalRingInput, RectCorner, RingInput } from "./types";
import type { SolidLike } from "./profileEngine";

const EPSILON = 0.001;
const MIN_EXTENT_MM = 1;

// A normalized ring, resolved to real numbers — like profileEngine.ts's own
// Section, just carrying lengthMm/widthMm instead of a single radiusMm (and
// no transition/curveDepth — those are resolved inside buildOvalProfileSamples
// below, not needed by anything that just wants a ring's own dims).
export interface OvalSection {
  zMm: number;
  lengthMm: number;
  widthMm: number;
  cap: boolean;
}

// [lengthMm, widthMm, zMm] — like profileEngine.ts's own Sample ([radiusMm,
// zMm]), just carrying both oval dimensions at once so a dense row always
// has a matched (length, width) pair at the same Z.
export type OvalSample = [number, number, number];

export function normalizeOvalRings(rings: OvalRingInput[]): OvalSection[] {
  const sections = rings.map((r) => ({
    zMm: num(r.z, 0),
    lengthMm: Math.max(num(r.length, 100), MIN_EXTENT_MM),
    widthMm: Math.max(num(r.width, 100), MIN_EXTENT_MM),
    cap: !!r.cap,
  }));
  // Descending Z, same convention as profileEngine.ts's normalizeRings:
  // sections[0] is the mouth/top ring, sections[last] is the bottom ring.
  return sections.sort((a, b) => b.zMm - a.zMm);
}

export function validateOvalSections(sections: OvalSection[]): void {
  for (let i = 0; i < sections.length - 1; i++) {
    if (Math.abs(sections[i].zMm - sections[i + 1].zMm) < EPSILON) {
      throw new Error("Hai vòng ngang không được trùng vị trí Z.");
    }
  }
}

function toRingInputs(rings: OvalRingInput[], axis: "length" | "width"): RingInput[] {
  return rings.map((r) => ({ z: r.z, diameter: axis === "length" ? r.length : r.width, transition: r.transition, curveDepth: r.curveDepth, cap: r.cap }));
}

// Builds the dense bowed profile by running Round's OWN Hermite/bow engine
// (profileEngine.ts's normalizeRings + buildProfileSamples — the exact same
// tangent-continuous curve Round's own body uses, not a re-derivation) TWICE
// — once treating length as the "diameter", once width — since an oval
// cross-section needs both, independently bowed. An earlier version of this
// bowed length/width itself with a plain linear (lerp) base instead of
// reusing Round's tangent-matched Hermite one, reasoning the tangent system
// only mattered for circular cross-sections — wrong: without it, the curve's
// SLOPE doesn't match across a ring boundary, so the body reads as faceted/
// kinked right at each ring instead of one smooth continuous bulge (visible
// on a Front/Left view as a lumpy, not-round, outline). Reusing Round's real
// algorithm fixes that outright instead of re-deriving the tangent math.
// The 2 resulting curves don't share identical Z sample positions (each
// axis's own tangent system nudges its Z samples slightly differently), so
// this resamples the width curve onto the length curve's own Z grid via
// radiusAtZ — negligible smoothness loss (the source curve is already
// densely sampled) in exchange for a guaranteed matched (length, width)
// pair at every Z.
export function buildOvalProfileSamples(rings: OvalRingInput[]): OvalSample[] {
  const lengthSamples = buildProfileSamples(normalizeRings(toRingInputs(rings, "length")));
  const widthSamples = buildProfileSamples(normalizeRings(toRingInputs(rings, "width")));
  return lengthSamples.map(([halfLength, z]) => [halfLength * 2, radiusAtZ(widthSamples, z) * 2, z]);
}

// (length, width) at an arbitrary Z, interpolated along the dense bowed
// profile — same role as math.ts's radiusAtZ, just for oval's 2 dimensions.
// Used wherever something (a frame ring, a cutout's synthetic Z cut, the
// handle mount) needs the body's real surface extent at a Z that isn't
// necessarily one of the entered rings' own.
export function ovalDimsAtZ(samples: OvalSample[], z: number): { length: number; width: number } {
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

export function ovalCornerToRect(c: OvalCorner): RectCorner {
  return { z: c.z, length: c.length, width: c.width, cornerR: c.width / 2, cap: c.cap };
}

function ovalRowPoints2D(length: number, width: number, segmentsPerCorner: number): [number, number][] {
  return buildRoundedRectPoints2D(length, width, width / 2, segmentsPerCorner);
}

// Point at fractional arc length t∈[0,1] along the "upper" half-perimeter
// path — from the +X tip (t=0), up over that end's own upper quarter-cap,
// across the straight top side, down the -X end's upper quarter-cap, to
// the -X tip (t=1). The "lower" half is this same path mirrored (y → -y).
// Shared by ovalFrameEngine.ts's vertical-rib placement (see its own
// comment for why an oval needs this instead of Rect's edge/corner scheme)
// and this file's own gap-aware perimeter builder below.
export function halfPerimeterPoint(length: number, width: number, t: number): [number, number] {
  const hl = length / 2;
  const r = width / 2;
  const straightLen = Math.max(length - width, 0);
  const quarterArc = (Math.PI / 2) * r;
  const total = straightLen + 2 * quarterArc;
  if (total < 0.0001) return [hl, 0];
  const s = Math.max(0, Math.min(1, t)) * total;

  if (s <= quarterArc) {
    const theta = s / Math.max(r, 0.0001);
    return [hl - r + r * Math.cos(theta), r * Math.sin(theta)];
  }
  if (s <= quarterArc + straightLen) {
    const frac = (s - quarterArc) / Math.max(straightLen, 0.0001);
    return [hl - r - straightLen * frac, r];
  }
  const theta = Math.PI / 2 - (s - quarterArc - straightLen) / Math.max(r, 0.0001);
  return [-(hl - r) - r * Math.cos(theta), r * Math.sin(theta)];
}

// 2 open strips, each running the "long way" around from just past one
// tip's gap to just before the other tip's gap — one along the +Y side,
// one along -Y — port of Round's cutoutSurfaceIntervals (its side(halfAngle)
// / side(π+halfAngle), just parametrized by arc-length t instead of angle).
// Together they cover the WHOLE perimeter minus 2 small tip windows, one
// at EACH end — unlike a single "closed loop minus 1 notch", this is what
// actually leaves both tips open at once.
function ovalGapIntervals(length: number, width: number, gapHalfWidth: number, segments: number): [number, number][][] {
  const r = width / 2;
  const thetaGap = Math.asin(Math.min(Math.max(gapHalfWidth / Math.max(r, 0.0001), 0), 0.999));
  const gapArc = r * thetaGap;
  const straightLen = Math.max(length - width, 0);
  const quarterArc = (Math.PI / 2) * r;
  const halfTotal = straightLen + 2 * quarterArc;
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

// Multi-row loft through the ENTIRE dense bowed profile — unlike the old
// model (which only ever lofted a flat 2-row frustum, mouth straight to
// base, since there was no bow option at all), this connects every
// consecutive PAIR of dense rows, so the body surface actually follows
// whatever bow the rings describe (a belly, a waist, several distinct
// segments — same freedom Round's own body has), not just a straight taper.
function buildOvalBodyGeometry(samples: OvalSample[], segmentsPerCorner: number): THREE.BufferGeometry {
  const rows = samples.map(([length, width, z]) => ({ z, pts: ovalRowPoints2D(length, width, segmentsPerCorner) }));
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
// off the FULL dense multi-ring profile (ovalDimsAtZ) instead of just
// mouth/base: outside the cutout's own Z band, every row-to-row strip is
// the FULL normal closed ring (no notch anywhere — an unaffected Z never
// loses any surface, same as Round's own circlePoints branch there); only
// the band that's actually inside the opening uses ovalGapIntervals, and —
// since its point count differs from a normal closed ring's — each quad is
// pushed with its own fresh 4 vertices (Round's own pushQuad pattern)
// rather than one shared indexed ring, so the two kinds of strip never need
// matching point counts.
function buildOvalBodyGeometryWithCutout(samples: OvalSample[], handle: HandleInput, segmentsPerCorner: number): THREE.BufferGeometry {
  const mouthZ = samples[0][2];
  const baseZ = samples[samples.length - 1][2];
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const gapHalfWidth = Math.max(handle.cutoutWidth, 10) / 2;
  const zTop = Math.min(mouthZ - offset, mouthZ);
  const zBottom = Math.max(zTop - depth, baseZ + 0.001);

  const zValues = [...samples.map((s) => s[2]), zTop, zBottom].sort((a, b) => b - a);
  const uniqueZ: number[] = [];
  for (const z of zValues) {
    if (uniqueZ.length === 0 || Math.abs(uniqueZ[uniqueZ.length - 1] - z) > EPSILON) uniqueZ.push(z);
  }
  const rows = uniqueZ.map((z) => ({ z, ...ovalDimsAtZ(samples, z) }));

  const positions: number[] = [];
  const indices: number[] = [];
  let cursor = 0;
  function pushQuad(p00: [number, number, number], p01: [number, number, number], p11: [number, number, number], p10: [number, number, number]) {
    const b = cursor;
    positions.push(...p00, ...p01, ...p11, ...p10);
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    cursor += 4;
  }

  const segments = Math.max(segmentsPerCorner * 4, 16);

  for (let i = 0; i < rows.length - 1; i++) {
    const rowA = rows[i];
    const rowB = rows[i + 1];
    const zMid = (rowA.z + rowB.z) / 2;
    const inBand = zMid < zTop - EPSILON && zMid > zBottom + EPSILON;

    if (inBand) {
      const intervalsA = ovalGapIntervals(rowA.length, rowA.width, gapHalfWidth, segments);
      const intervalsB = ovalGapIntervals(rowB.length, rowB.width, gapHalfWidth, segments);
      intervalsA.forEach((ia, idx) => {
        const ib = intervalsB[idx];
        const n = Math.min(ia.length, ib.length);
        for (let k = 0; k < n - 1; k++) {
          pushQuad([ia[k][0], ia[k][1], rowA.z], [ia[k + 1][0], ia[k + 1][1], rowA.z], [ib[k + 1][0], ib[k + 1][1], rowB.z], [ib[k][0], ib[k][1], rowB.z]);
        }
      });
      continue;
    }

    const ptsA = ovalRowPoints2D(rowA.length, rowA.width, segmentsPerCorner);
    const ptsB = ovalRowPoints2D(rowB.length, rowB.width, segmentsPerCorner);
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

export interface OvalSolidResult extends SolidLike {
  samples: OvalSample[];
}

export function buildOvalSolid(
  profile: OvalProfileInput,
  lid: LidInput = {},
  handle: HandleInput = DEFAULT_HANDLE,
  segmentsPerCorner = DEFAULT_RECT_SEGMENTS_PER_CORNER,
  // Optional dense (length, width, z) profile to loft the BODY from instead
  // of the rings' own bow curve — set while "Khóa dáng" is active (see
  // page.tsx's ovalDenseSamples), same role as buildRoundSolid's own
  // denseSamples param: rings stay free to add/remove/reposition without
  // touching the already-locked shape.
  denseSamples?: OvalSample[],
): OvalSolidResult {
  if (!profile.rings || profile.rings.length < 2) {
    throw new Error("Cần ít nhất 2 vòng để dựng hình.");
  }
  const sections = normalizeOvalRings(profile.rings);
  validateOvalSections(sections);
  const samples = denseSamples && denseSamples.length >= 2 ? denseSamples : buildOvalProfileSamples(profile.rings);

  const body = handle.type === "cutout" ? buildOvalBodyGeometryWithCutout(samples, handle, segmentsPerCorner) : buildOvalBodyGeometry(samples, segmentsPerCorner);

  const mouthSection = sections[0];
  const baseSection = sections[sections.length - 1];
  const basePts = ovalRowPoints2D(baseSection.lengthMm, baseSection.widthMm, segmentsPerCorner);
  const bottomCap = baseSection.cap ? buildRectCapGeometry(basePts, baseSection.zMm) : undefined;
  const mouthRect: RectCorner = { z: mouthSection.zMm, length: mouthSection.lengthMm, width: mouthSection.widthMm, cornerR: mouthSection.widthMm / 2 };

  return { body, bottomCap, lid: buildRectLidGeometry(mouthRect, lid, segmentsPerCorner), samples };
}
