// "Cánh hoa" (scalloped/petal) mouth rim: the mouth ring's height undulates
// by angle instead of sitting flat at one Z — N petals, each a smooth
// circular arc from one junction ("valley") up to its own apex and back
// down to the next valley. The arc's shape (width/height) is computed in an
// "unrolled" (arc-length, local-z) plane at a constant reference radius (the
// mouth's own), but each point's actual radius is then looked up on the
// plain (non-scalloped) body surface at that point's real Z (see
// scallopPoint3 / radiusAtZ) — the petals are carved INTO the existing body
// taper, not hung off the mouth as a flat-radius skirt.
//
// The mouth ring's ENTERED Z (Section.zMm, i.e. the product's stated
// overall height) is the PETAL APEX level — not a base the petals rise
// from. Petals carve DOWN from there by `heightMm`, so typing "Chiều cao"
// for the mouth still means "this is how tall the finished piece is."
// `ScallopGeometry.baseZMm` holds that apex reference throughout this file.
//
// Unlike handlePaths.ts's curvedHandlePoints (which special-cases
// height≥halfWidth with straight "legs", and has a known symmetry bug in
// that branch — flagged separately), every petal here is ALWAYS a single
// circle-through-3-points arc (valley, apex, valley), computed directly in
// the "unrolled" (arc-length, z) plane where circumference position is
// arc-length s = radius·angle — an EXACT relationship (not the linear
// tangent-offset approximation handlePaths.ts uses for small handles),
// which matters here because petals can span a large fraction of the
// mouth's circumference.
import * as THREE from "three";
import { radiusAtZ, type Sample } from "./math";
import type { ScallopInput } from "./types";

export function scallopPetalWidthMm(radiusMm: number, count: number): number {
  return (2 * Math.PI * radiusMm) / Math.max(count, 3);
}

export function resolveScallopHeightMm(scallop: ScallopInput, widthMm: number): number {
  return scallop.height != null && scallop.height > 0 ? scallop.height : widthMm / 2;
}

// One circle through (-halfArc, 0), (0, height), (+halfArc, 0) in local
// (arc-length s, height z) space. Returns points from the left valley
// through the apex to the right valley (2*segments+1 points).
export function scallopArcProfile(halfArc: number, heightMm: number, segments = 8): Array<[number, number]> {
  const h = Math.max(heightMm, 0.001);
  const a = Math.max(halfArc, 0.001);
  const c = (h * h - a * a) / (2 * h);
  const circleR = h - c;
  const thetaApex = Math.PI / 2;
  const thetaValley = Math.atan2(-c, a);
  const pts: Array<[number, number]> = [];
  for (let i = segments; i >= 0; i--) {
    const theta = thetaApex + (thetaValley - thetaApex) * (i / segments);
    pts.push([-(circleR * Math.cos(theta)), c + circleR * Math.sin(theta)]);
  }
  for (let i = 1; i <= segments; i++) {
    const theta = thetaApex + (thetaValley - thetaApex) * (i / segments);
    pts.push([circleR * Math.cos(theta), c + circleR * Math.sin(theta)]);
  }
  return pts;
}

// Exact tangent direction (ds, dz) of the arc at the right valley (s=+halfArc),
// pointing OUTWARD (away from the apex) — used to fillet the junction
// between two petals. Derived analytically from the same circle
// parametrization as scallopArcProfile, not a finite-difference estimate.
function scallopValleyTangentOut(halfArc: number, heightMm: number): [number, number] {
  const h = Math.max(heightMm, 0.001);
  const a = Math.max(halfArc, 0.001);
  const c = (h * h - a * a) / (2 * h);
  const thetaValley = Math.atan2(-c, a);
  // d/dtheta of (circleR cosθ, c + circleR sinθ) = (-sinθ, cosθ); increasing
  // theta moves toward the apex, so the OUTWARD (away from apex) direction
  // is the negative of that.
  const dir: [number, number] = [Math.sin(thetaValley), -Math.cos(thetaValley)];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  return [dir[0] / len, dir[1] / len];
}

export interface ScallopGeometry {
  count: number;
  radiusMm: number;
  baseZMm: number;
  widthMm: number;
  heightMm: number;
  segmentsPerHalf: number;
  samples: Sample[];
}

// `samples` is the plain (non-scalloped) body profile — mouth (samples[0])
// down to the bottom. The petal shape is carved INTO that surface: width and
// the mouth-level reference radius come from samples[0], but every petal
// point's actual radius is looked up at its own Z via radiusAtZ, so a valley
// (which sits below the mouth) lands on the body wall's real taper instead
// of hanging off the mouth's flat radius.
export function resolveScallopGeometry(scallop: ScallopInput, samples: Sample[], segmentsPerHalf = 8): ScallopGeometry {
  const radiusMm = samples[0][0];
  const baseZMm = samples[0][1];
  const count = Math.max(Math.round(scallop.count), 3);
  const widthMm = scallopPetalWidthMm(radiusMm, count);
  const heightMm = resolveScallopHeightMm(scallop, widthMm);
  return { count, radiusMm, baseZMm, widthMm, heightMm, segmentsPerHalf, samples };
}

// Point count of one full ring built by buildScallopRingPoints — callers
// that need to keep OTHER (non-scalloped) rows in the same mesh vertex-
// aligned with the scalloped row must use this as their own segment count.
export function scallopSegmentCount(geo: ScallopGeometry): number {
  return geo.count * geo.segmentsPerHalf * 2;
}

export function scallopApexAngle(geo: ScallopGeometry, k: number): number {
  return (2 * Math.PI * k) / geo.count;
}
export function scallopValleyAngle(geo: ScallopGeometry, k: number): number {
  return scallopApexAngle(geo, k) - Math.PI / geo.count;
}

// `z` here is the LOCAL profile coordinate from scallopArcProfile (0 at a
// valley, heightMm at the apex) — shifted so the apex lands exactly at
// geo.baseZMm (the mouth's entered height) and valleys sit heightMm below it.
// The radius at that point is NOT held constant at the mouth's own radius —
// it's looked up on the plain (non-scalloped) body surface at the point's
// actual Z, so the petal reads as carved into the existing taper between the
// mouth and the next ring, not as a flat-radius skirt hanging off the mouth.
function scallopPoint3(geo: ScallopGeometry, angle: number, z: number): THREE.Vector3 {
  const actualZ = geo.baseZMm - geo.heightMm + z;
  const radius = radiusAtZ(geo.samples, actualZ);
  return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), actualZ);
}

// Z offset from the mouth's entered height (the apex level) at an arbitrary
// absolute angle — 0 exactly at each apex, -heightMm at each valley. Used to
// anchor vertical ribs exactly on the rim surface regardless of where they land.
export function scallopZOffsetAtAngle(geo: ScallopGeometry, angle: number): number {
  const petalAngle = (2 * Math.PI) / geo.count;
  const k = Math.round(angle / petalAngle);
  const local = angle - k * petalAngle; // signed offset from nearest apex, in radians
  const s = local * geo.radiusMm;
  const halfArc = geo.widthMm / 2;
  const h = Math.max(geo.heightMm, 0.001);
  const a = Math.max(halfArc, 0.001);
  const c = (h * h - a * a) / (2 * h);
  const circleR = h - c;
  const clampedS = Math.max(-a, Math.min(a, s));
  const zLocal = c + Math.sqrt(Math.max(circleR * circleR - clampedS * clampedS, 0)); // 0 at valley .. h at apex
  return zLocal - h; // shift: 0 at apex .. -h at valley
}

// The exact (non-uniform) angle sequence buildScallopRingPoints places its
// points at — bunched up near each apex, spread out near each valley, since
// scallopArcProfile steps evenly in the local circle's THETA, not in angle.
// Any other row that gets lofted against the scalloped mouth row (a plain
// circle at some other Z) must reuse this exact angle list index-for-index;
// sampling it at uniformly-spaced angles instead (circlePoints' way) would
// pair up mismatched angular positions between the two rows and twist the
// quads between them into the self-intersecting notches seen at the rim.
export function scallopRingAngles(geo: ScallopGeometry): number[] {
  const halfArc = geo.widthMm / 2;
  const profile = scallopArcProfile(halfArc, geo.heightMm, geo.segmentsPerHalf);
  const angles: number[] = [];
  for (let k = 0; k < geo.count; k++) {
    const apexAngle = scallopApexAngle(geo, k);
    for (let i = 0; i < profile.length - 1; i++) {
      const [s] = profile[i];
      angles.push(apexAngle + s / geo.radiusMm);
    }
  }
  return angles;
}

// A plain circle (constant radius/z) sampled at the SAME angles as the
// scalloped mouth ring — see scallopRingAngles.
export function circlePointsAtAngles(radiusMm: number, zMm: number, angles: number[]): THREE.Vector3[] {
  return angles.map((angle) => new THREE.Vector3(radiusMm * Math.cos(angle), radiusMm * Math.sin(angle), zMm));
}

// Full ring, all N petals concatenated with no duplicate points at the
// shared valleys — closed:true, same convention as circlePoints3.
export function buildScallopRingPoints(geo: ScallopGeometry): THREE.Vector3[] {
  const halfArc = geo.widthMm / 2;
  const profile = scallopArcProfile(halfArc, geo.heightMm, geo.segmentsPerHalf);
  const points: THREE.Vector3[] = [];
  for (let k = 0; k < geo.count; k++) {
    const apexAngle = scallopApexAngle(geo, k);
    for (let i = 0; i < profile.length - 1; i++) {
      const [s, z] = profile[i];
      points.push(scallopPoint3(geo, apexAngle + s / geo.radiusMm, z));
    }
  }
  return points;
}

// One independent arch per petal (valley → apex → valley, both endpoints
// included) — for the "separate" frame style where each petal is its own
// welded-in piece rather than one continuous bent ring.
export function buildScallopPetalArch(geo: ScallopGeometry, k: number): THREE.Vector3[] {
  const halfArc = geo.widthMm / 2;
  const profile = scallopArcProfile(halfArc, geo.heightMm, geo.segmentsPerHalf);
  const apexAngle = scallopApexAngle(geo, k);
  return profile.map(([s, z]) => scallopPoint3(geo, apexAngle + s / geo.radiusMm, z));
}

// Standard angle-bisector fillet between two rays leaving a common point.
// dirIn/dirOut are unit vectors pointing AWAY from the corner along each
// side. Returns null if the corner is too shallow/too sharp for the given
// radius (falls back to the unfilleted corner).
function filletBetweenRays(
  corner: [number, number],
  dirIn: [number, number],
  dirOut: [number, number],
  radius: number,
): { center: [number, number]; startAngle: number; endAngle: number; trimIn: number; trimOut: number } | null {
  const dot = Math.max(-1, Math.min(1, dirIn[0] * dirOut[0] + dirIn[1] * dirOut[1]));
  const angleBetween = Math.acos(dot);
  const halfAngle = angleBetween / 2;
  if (halfAngle < 0.02 || halfAngle > Math.PI / 2 - 0.001) return null;
  const trim = radius / Math.tan(halfAngle);
  const bisectorRaw: [number, number] = [dirIn[0] + dirOut[0], dirIn[1] + dirOut[1]];
  const bisectorLen = Math.hypot(bisectorRaw[0], bisectorRaw[1]) || 1;
  const bisector: [number, number] = [bisectorRaw[0] / bisectorLen, bisectorRaw[1] / bisectorLen];
  const distToCenter = radius / Math.sin(halfAngle);
  const center: [number, number] = [corner[0] + bisector[0] * distToCenter, corner[1] + bisector[1] * distToCenter];
  const tangentIn: [number, number] = [corner[0] + dirIn[0] * trim, corner[1] + dirIn[1] * trim];
  const tangentOut: [number, number] = [corner[0] + dirOut[0] * trim, corner[1] + dirOut[1] * trim];
  const startAngle = Math.atan2(tangentIn[1] - center[1], tangentIn[0] - center[0]);
  const endAngle = Math.atan2(tangentOut[1] - center[1], tangentOut[0] - center[0]);
  return { center, startAngle, endAngle, trimIn: trim, trimOut: trim };
}

// The continuous ring style needs a small fillet at each valley (a real
// bend can't hold a sharp cusp) — computed once in the local (s,z) plane at
// the valley (symmetric: the incoming/outgoing tangents are mirror images
// of each other by construction) and reused at every valley by rotation.
function valleyFilletLocal(halfArc: number, heightMm: number, filletMm: number, segments = 8): Array<[number, number]> | null {
  const tangentOut = scallopValleyTangentOut(halfArc, heightMm); // direction leaving the valley into the NEXT petal
  const tangentIn: [number, number] = [-tangentOut[0], tangentOut[1]]; // mirror image, direction leaving the valley back into the PREVIOUS petal (reversed = "coming from")
  const fillet = filletBetweenRays([halfArc, 0], tangentIn, tangentOut, filletMm);
  if (!fillet) return null;
  const { center, startAngle, endAngle } = fillet;
  let end = endAngle;
  // walk the short way from startAngle to endAngle
  while (end - startAngle > Math.PI) end -= 2 * Math.PI;
  while (end - startAngle < -Math.PI) end += 2 * Math.PI;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (end - startAngle) * (i / segments);
    pts.push([center[0] + filletMm * Math.cos(a), center[1] + filletMm * Math.sin(a)]);
  }
  return pts;
}

// Full ring with a small fillet spliced in at every valley junction.
export function buildScallopRingPointsFilleted(geo: ScallopGeometry, filletMm: number): THREE.Vector3[] {
  if (filletMm <= 0.01) return buildScallopRingPoints(geo);
  const halfArc = geo.widthMm / 2;
  const profile = scallopArcProfile(halfArc, geo.heightMm, geo.segmentsPerHalf);
  const filletLocal = valleyFilletLocal(halfArc, geo.heightMm, Math.min(filletMm, halfArc * 0.4));
  if (!filletLocal) return buildScallopRingPoints(geo);

  // Trim the profile's tail/head to exactly where the fillet's own tangent
  // point sits (filletLocal[0] is that point, by construction of the fillet
  // arc), so the straight-arc portion meets the fillet tangentially instead
  // of overlapping or gapping it.
  const trimS = Math.abs(filletLocal[0][0]);
  const trimmed = profile.filter(([s]) => Math.abs(s) <= trimS + 0.01);

  const points: THREE.Vector3[] = [];
  for (let k = 0; k < geo.count; k++) {
    const apexAngle = scallopApexAngle(geo, k);
    for (const [s, z] of trimmed) points.push(scallopPoint3(geo, apexAngle + s / geo.radiusMm, z));
    // fillet sits at this petal's RIGHT valley, mapped by rotating the local
    // (s,z) fillet into this petal's angular frame.
    for (const [s, z] of filletLocal) points.push(scallopPoint3(geo, apexAngle + s / geo.radiusMm, z));
  }
  return points;
}
