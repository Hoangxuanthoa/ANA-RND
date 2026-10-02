import { normalizeRings, segmentSamples } from "./profileEngine";
import { buildDiameterSpline, suggestRingZs, type DiameterPoint } from "./photoSpline";
import type { PhotoTraceInput, PhotoTracePoint, RingInput, Section } from "./types";

export interface CalibrationResult {
  scaleMmPerPx: number | null;
  heightMm: number | null;
  mouthMm: number | null;
  maxDiameterMm: number | null;
  baseMm: number | null;
}

function sortedByY(points: PhotoTracePoint[]): PhotoTracePoint[] {
  return [...points].sort((a, b) => a.yPx - b.yPx);
}

function diameterAt(p: PhotoTracePoint, axisXPx: number): number {
  return 2 * Math.abs(p.xPx - axisXPx);
}

const NULL_RESULT: CalibrationResult = { scaleMmPerPx: null, heightMm: null, mouthMm: null, maxDiameterMm: null, baseMm: null };

interface ResolvedCurve {
  scaleMmPerPx: number;
  mmPoints: DiameterPoint[]; // final, warped — z measured up from the base
  heightMm: number;
  mouthMm: number;
  baseMm: number;
  maxDiameterMm: number;
}

// A photo alone has no real-world scale, so at least ONE override has to
// bootstrap a uniform px→mm scale (applied to both axes, since a straight-on
// photo has no separate horizontal/vertical scale). Every OTHER override
// then warps the diameter curve to hit its exact value too, via a smooth
// multiplicative ratio-spline (ratio 1 far from any anchor, exact at each
// one, smoothly blended between) rather than a blunt uniform rescale — that
// keeps the traced curve's own shape/proportions between anchors instead of
// flattening them. Height is the one axis that can't be warped this way
// (there's nothing to anchor a ratio TO along z besides the endpoints
// already used for the bootstrap), so a height override is applied as a
// separate, simple uniform Z stretch on top.
function resolveCurve(trace: PhotoTraceInput): ResolvedCurve | null {
  const pts = sortedByY(trace.points);
  if (pts.length < 2) return null;

  const top = pts[0];
  const bottom = pts[pts.length - 1];
  const heightPx = bottom.yPx - top.yPx;
  const mouthPx = diameterAt(top, trace.axisXPx);
  const basePx = diameterAt(bottom, trace.axisXPx);
  const maxDiameterPx = Math.max(...pts.map((p) => diameterAt(p, trace.axisXPx)));

  const overrides = {
    mouth: trace.mouthMmOverride,
    maxBody: trace.maxBodyMmOverride,
    base: trace.baseMmOverride,
    height: trace.heightMmOverride,
  };
  const refPxByType = { mouth: mouthPx, maxBody: maxDiameterPx, base: basePx, height: heightPx };

  const bootstrapType =
    overrides.height != null
      ? ("height" as const)
      : (["mouth", "maxBody", "base"] as const).find((k) => overrides[k] != null && overrides[k]! > 0);
  if (!bootstrapType) return null;

  const bootstrapValue = overrides[bootstrapType]!;
  const bootstrapRefPx = refPxByType[bootstrapType];
  if (!(bootstrapRefPx > 0) || !(bootstrapValue > 0)) return null;
  const scaleMmPerPx = bootstrapValue / bootstrapRefPx;

  const bottomYPx = bottom.yPx;
  const baselineMm: DiameterPoint[] = pts.map((p) => ({
    z: (bottomYPx - p.yPx) * scaleMmPerPx,
    diameter: diameterAt(p, trace.axisXPx) * scaleMmPerPx,
  }));

  const zScale = overrides.height != null && bootstrapType !== "height" ? overrides.height / baselineMm[0].z : 1;
  const zCorrected: DiameterPoint[] = zScale === 1 ? baselineMm : baselineMm.map((p) => ({ z: p.z * zScale, diameter: p.diameter }));

  const baseSpline = buildDiameterSpline(zCorrected);
  const mouthZ = zCorrected[0].z;
  const baseZ = zCorrected[zCorrected.length - 1].z;
  const maxBodyPoint = zCorrected.reduce((a, b) => (b.diameter > a.diameter ? b : a));

  const diameterAnchors: DiameterPoint[] = [];
  if (overrides.mouth != null && overrides.mouth > 0) diameterAnchors.push({ z: mouthZ, diameter: overrides.mouth / baseSpline(mouthZ) });
  if (overrides.base != null && overrides.base > 0) diameterAnchors.push({ z: baseZ, diameter: overrides.base / baseSpline(baseZ) });
  if (overrides.maxBody != null && overrides.maxBody > 0) {
    diameterAnchors.push({ z: maxBodyPoint.z, diameter: overrides.maxBody / baseSpline(maxBodyPoint.z) });
  }

  const diameterAt2: (z: number) => number =
    diameterAnchors.length === 0
      ? baseSpline
      : diameterAnchors.length === 1
        ? (z) => baseSpline(z) * diameterAnchors[0].diameter
        : (() => {
            const ratioSpline = buildDiameterSpline(diameterAnchors);
            return (z: number) => baseSpline(z) * ratioSpline(z);
          })();

  const mmPoints = zCorrected.map((p) => ({ z: p.z, diameter: diameterAt2(p.z) }));

  return {
    scaleMmPerPx,
    mmPoints,
    heightMm: mouthZ,
    mouthMm: diameterAt2(mouthZ),
    baseMm: diameterAt2(baseZ),
    maxDiameterMm: Math.max(...mmPoints.map((p) => p.diameter)),
  };
}

export function computeCalibration(trace: PhotoTraceInput): CalibrationResult {
  const curve = resolveCurve(trace);
  if (!curve) return NULL_RESULT;
  return {
    scaleMmPerPx: curve.scaleMmPerPx,
    heightMm: curve.heightMm,
    mouthMm: curve.mouthMm,
    maxDiameterMm: curve.maxDiameterMm,
    baseMm: curve.baseMm,
  };
}

// z measured up from the base point, matching RingInput.z's convention —
// the FINAL (post-warp) points, already reflecting every set override.
export function tracePointsToMm(trace: PhotoTraceInput): DiameterPoint[] {
  return resolveCurve(trace)?.mmPoints ?? [];
}

export function autoSuggestRingZs(trace: PhotoTraceInput): number[] {
  const mmPoints = tracePointsToMm(trace);
  if (mmPoints.length < 2) return [];
  return suggestRingZs(mmPoints).map((z) => Math.round(z));
}

// Solve segment i's curveDepth so the ENGINE's own rendered curve (not an
// approximation of it) matches the spline at that segment's real midpoint
// sample. tangentAngle() (profileEngine.ts) — which is what makes a ring's
// curve depend on its NEIGHBORS, and is the reason adding/removing a ring
// used to visibly shift nearby segments even though only their endpoints'
// diameters stayed the same — depends only on ring Z/diameter positions and
// transition TYPE, never on curveDepth's numeric value. So once positions
// and transition types are fixed, every segment's curveDepth can be solved
// independently by bisection (bowedRadius is monotonic in depth).
function fitCurveDepth(sections: Section[], index: number, spline: (z: number) => number): number {
  const a = sections[index];
  const b = sections[index + 1];
  const sampleAt = (depth: number): { z: number; diameter: number } => {
    a.curveDepth = depth;
    const pts = segmentSamples(a, b, index, sections);
    const mid = pts[Math.floor(pts.length / 2)];
    return { z: mid[1], diameter: mid[0] * 2 };
  };
  const errorAt = (depth: number) => {
    const { z, diameter } = sampleAt(depth);
    return diameter - spline(z);
  };

  let lo = 0;
  let hi = 0.65;
  const errLo = errorAt(lo);
  const errHi = errorAt(hi);
  if (Math.sign(errLo) === Math.sign(errHi) || errLo === 0) return Math.abs(errLo) <= Math.abs(errHi) ? lo : hi;

  for (let iter = 0; iter < 24; iter++) {
    const mid = (lo + hi) / 2;
    const errMid = errorAt(mid);
    if (Math.sign(errMid) === Math.sign(errLo)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// rings[0] is the mouth and rings[last] is the base (RoundProfileForm's own
// convention) — z descending.
export function buildRingsFromTrace(trace: PhotoTraceInput): RingInput[] | null {
  const mmPoints = tracePointsToMm(trace);
  if (mmPoints.length < 2) return null;

  const zsAsc = [...new Set((trace.ringZMm.length >= 2 ? trace.ringZMm : suggestRingZs(mmPoints)).map((z) => Math.round(z)))].sort(
    (a, b) => a - b,
  );
  if (zsAsc.length < 2) return null;

  const spline = buildDiameterSpline(mmPoints);
  const zsDesc = zsAsc.slice().sort((a, b) => b - a);

  const initialRings: RingInput[] = zsDesc.map((z, i) => {
    const diameter = spline(z);
    if (i === zsDesc.length - 1) return { z, diameter, transition: "straight", cap: true };

    const next = zsDesc[i + 1];
    const zMid = (z + next) / 2;
    const splineMid = spline(zMid);
    const linearMid = (diameter + spline(next)) / 2;
    const delta = splineMid - linearMid;
    const available = Math.abs(diameter - spline(next));

    const transition = available > 1 && Math.abs(delta) > 1 ? (delta >= 0 ? "outward" : "inward") : "straight";
    return { z, diameter, transition };
  });

  const sections = normalizeRings(initialRings);
  for (let i = 0; i < sections.length - 1; i++) {
    if (sections[i].transition === "straight") continue;
    sections[i].curveDepth = fitCurveDepth(sections, i, spline);
  }

  return sections.map((s, i) => {
    if (i === sections.length - 1) {
      return { z: Math.round(s.zMm), diameter: Math.round(s.diameterMm), transition: "straight", cap: true };
    }
    return {
      z: Math.round(s.zMm),
      diameter: Math.round(s.diameterMm),
      transition: s.transition,
      curveDepth: s.transition === "straight" ? undefined : Math.round(s.curveDepth * 1000) / 1000,
    };
  });
}
