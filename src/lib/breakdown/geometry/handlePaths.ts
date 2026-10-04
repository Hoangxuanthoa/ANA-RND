// Shared handle centerline geometry, ported from ANASU's FrameEngine
// (curved/square standing handle + cutout side/lower/upper bars) and
// ProfileEngine (build_handle_centerlines). Used by:
// - frameEngine.ts: each path becomes a steel tube.
// - the Solid view: each path becomes a thin guide line, same as ANASU
//   draws handle centerlines on the Solid/Profile even without a frame.
import * as THREE from "three";
import { clamp } from "./math";
import { radiusAtZ, type Sample } from "./profileEngine";
import type { HandleInput, Section } from "./types";

function localHandlePoint(radial: [number, number], tangent: [number, number], x: number, zLocal: number, r: number, baseZ: number): THREE.Vector3 {
  return new THREE.Vector3(radial[0] * r + tangent[0] * x, radial[1] * r + tangent[1] * x, baseZ + zLocal);
}

// Exported for reuse by rectHandlePaths.ts: with centerAngle=0/π (radial
// along X) or π/2/-π/2 (radial along Y), these sweep a handle from a flat
// wall exactly as well as from a circular one — the radial/tangent basis
// vectors don't care which shape "baseR"/"apexR" came from.
export function curvedHandlePoints(centerAngle: number, baseR: number, apexR: number, baseZ: number, width: number, height: number): THREE.Vector3[] {
  const radial: [number, number] = [Math.cos(centerAngle), Math.sin(centerAngle)];
  const tangent: [number, number] = [-Math.sin(centerAngle), Math.cos(centerAngle)];
  const halfW = width / 2;
  const points: THREE.Vector3[] = [];

  if (height >= halfW - 0.001) {
    const legH = height - halfW;
    for (let i = 0; i <= 4; i++) {
      const z = (legH * i) / 4;
      const r = baseR + ((apexR - baseR) * z) / Math.max(height, 0.001);
      points.push(localHandlePoint(radial, tangent, -halfW, z, r, baseZ));
    }
    for (let i = 1; i <= 12; i++) {
      const theta = Math.PI - (Math.PI * i) / 12;
      const x = halfW * Math.cos(theta);
      const zLocal = legH + halfW * Math.sin(theta);
      const r = baseR + ((apexR - baseR) * zLocal) / Math.max(height, 0.001);
      points.push(localHandlePoint(radial, tangent, x, zLocal, r, baseZ));
    }
  } else {
    const h = Math.max(height, 0.001);
    const c = (h * h - halfW * halfW) / (2 * h);
    const circleR = h - c;
    const thetaL = Math.atan2(-c, -halfW);
    let thetaR = Math.atan2(-c, halfW);
    while (thetaR >= thetaL) thetaR -= 2 * Math.PI;
    for (let i = 0; i <= 20; i++) {
      const theta = thetaL + ((thetaR - thetaL) * i) / 20;
      const x = circleR * Math.cos(theta);
      const zLocal = c + circleR * Math.sin(theta);
      const r = baseR + ((apexR - baseR) * zLocal) / h;
      points.push(localHandlePoint(radial, tangent, x, zLocal, r, baseZ));
    }
  }
  return points;
}

export function squareHandlePoints(centerAngle: number, baseR: number, apexR: number, baseZ: number, height: number, width: number, filletR = 5): THREE.Vector3[] {
  const radial: [number, number] = [Math.cos(centerAngle), Math.sin(centerAngle)];
  const tangent: [number, number] = [-Math.sin(centerAngle), Math.cos(centerAngle)];
  const halfW = width / 2;
  const h = Math.max(height, 0.001);
  const r = Math.min(Math.max(filletR, 0), halfW * 0.45, h * 0.45);
  const map = (x: number, zLocal: number) => {
    const rr = baseR + (apexR - baseR) * (zLocal / h);
    return localHandlePoint(radial, tangent, x, zLocal, rr, baseZ);
  };
  if (r <= 0.001) return [map(-halfW, 0), map(-halfW, h), map(halfW, h), map(halfW, 0)];

  const pts: THREE.Vector3[] = [map(-halfW, 0), map(-halfW, h - r)];
  const cxL = -halfW + r;
  const cz = h - r;
  for (let i = 1; i <= 8; i++) {
    const theta = Math.PI - (Math.PI * 0.5 * i) / 8;
    pts.push(map(cxL + r * Math.cos(theta), cz + r * Math.sin(theta)));
  }
  pts.push(map(halfW - r, h));
  const cxR = halfW - r;
  for (let i = 1; i <= 8; i++) {
    const theta = Math.PI * 0.5 - (Math.PI * 0.5 * i) / 8;
    pts.push(map(cxR + r * Math.cos(theta), cz + r * Math.sin(theta)));
  }
  pts.push(map(halfW, 0));
  return pts;
}

function surfacePointAtLocalChord(samples: Sample[], z: number, centerAngle: number, localX: number): THREE.Vector3 {
  const radius = Math.max(radiusAtZ(samples, z), 0.001);
  const x = clamp(localX, -radius * 0.999, radius * 0.999);
  const angle = centerAngle + Math.asin(x / radius);
  return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
}

function surfaceArcAtZ(samples: Sample[], z: number, centerAngle: number, halfWidth: number, segments: number): THREE.Vector3[] {
  const radius = Math.max(radiusAtZ(samples, z), 0.001);
  const halfAngle = Math.asin(clamp(halfWidth / radius, 0, 0.999));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = centerAngle - halfAngle + (2 * halfAngle * i) / segments;
    pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), z));
  }
  return pts;
}

function cutoutLowerBarPoints(samples: Sample[], z: number, centerAngle: number, halfWidth: number, filletR: number): THREE.Vector3[] {
  const r = Math.min(filletR, halfWidth * 0.45, filletR * 0.9 + halfWidth * 0.1);
  if (r <= 0.001) return surfaceArcAtZ(samples, z, centerAngle, halfWidth, 20);

  const pts: THREE.Vector3[] = [];
  let cx = -halfWidth + r;
  const cz = z + r;
  for (let i = 0; i <= 8; i++) {
    const theta = Math.PI + (Math.PI * 0.5 * i) / 8;
    pts.push(surfacePointAtLocalChord(samples, cz + r * Math.sin(theta), centerAngle, cx + r * Math.cos(theta)));
  }
  for (let i = 1; i <= 20; i++) {
    const x = -halfWidth + r + (2 * (halfWidth - r) * i) / 20;
    pts.push(surfacePointAtLocalChord(samples, z, centerAngle, x));
  }
  cx = halfWidth - r;
  for (let i = 1; i <= 8; i++) {
    const theta = -Math.PI * 0.5 + (Math.PI * 0.5 * i) / 8;
    pts.push(surfacePointAtLocalChord(samples, cz + r * Math.sin(theta), centerAngle, cx + r * Math.cos(theta)));
  }
  return pts;
}

function computeStandingPaths(top: Section, handle: HandleInput): THREE.Vector3[][] {
  const mouthR = top.radiusMm;
  const paths: THREE.Vector3[][] = [];
  if (mouthR <= 0.001 || handle.height <= 0.001) return paths;
  const lines = handle.lines === 2 ? 2 : 1;

  for (let side = 0; side < 2; side++) {
    const centerAngle = side === 0 ? 0 : Math.PI;
    for (let li = 0; li < lines; li++) {
      const inward = lines === 2 ? (li === 0 ? 0 : handle.offset) : 0;
      const innerWidth = Math.max(handle.width - 2 * inward, 10);
      const innerHeight = Math.max(handle.height - inward, 5);
      const innerHalfAngle = Math.asin(clamp(innerWidth / (2 * mouthR), 0, 0.999));
      const baseR = mouthR * Math.cos(innerHalfAngle);
      const apexR =
        handle.leanMode === "vertical"
          ? baseR
          : handle.leanMode === "manual"
            ? mouthR + Math.tan((handle.leanAngle * Math.PI) / 180) * innerHeight
            : mouthR;

      const pts =
        handle.shape === "square"
          ? squareHandlePoints(centerAngle, baseR, apexR, top.zMm, innerHeight, innerWidth, handle.fillet)
          : curvedHandlePoints(centerAngle, baseR, apexR, top.zMm, innerWidth, innerHeight);
      paths.push(pts);
    }
  }
  return paths;
}

function computeCutoutPaths(top: Section, samples: Sample[], handle: HandleInput): THREE.Vector3[][] {
  const paths: THREE.Vector3[][] = [];
  const mouthZ = top.zMm;
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const width = Math.max(handle.cutoutWidth, 10);
  const filletR = Math.max(handle.fillet, 0);
  const zUpper = mouthZ - offset;
  const zLower = zUpper - depth;

  for (let side = 0; side < 2; side++) {
    const center = side === 0 ? 0 : Math.PI;
    const halfW = width / 2;
    const rBottom = Math.min(filletR, halfW * 0.45, depth * 0.45);

    const sideZs: number[] = [];
    for (let i = 0; i <= 18; i++) sideZs.push(zLower + rBottom + (mouthZ - (zLower + rBottom)) * (i / 18));
    const leftPts = sideZs.map((z) => surfacePointAtLocalChord(samples, z, center, -halfW));
    const rightPts = sideZs.map((z) => surfacePointAtLocalChord(samples, z, center, halfW));

    const lowerPts = cutoutLowerBarPoints(samples, zLower, center, halfW, rBottom);
    paths.push([lowerPts[0], ...leftPts.slice(1)]);
    paths.push([lowerPts[lowerPts.length - 1], ...rightPts.slice(1)]);
    paths.push(lowerPts);

    // Always draw the upper boundary explicitly — even at offset 0, where
    // it sits right on the mouth rim — instead of relying on the side bars
    // to visually meet the separately-drawn mouth ring. Two unstitched
    // tubes merely touching at a point reads as a notch/gap in the rim
    // rather than a continuous opening edge.
    paths.push(surfaceArcAtZ(samples, zUpper, center, halfW, 16));
  }
  return paths;
}

// Round variant of the cutout handle: one full circular opening (diameter =
// cutoutWidth, cutoutDepth unused — a circle has no separate depth) per
// side, instead of the rect cutout's rounded rectangle. Only ONE member
// shape per side here — the circle's own rim, traced on the curved body
// surface. Unlike the rect cutout, there's no "side bars reconnecting to
// the mouth" member to draw: when there's a gap (cutoutOffset > 0), the
// reconnecting piece above the circle is just the EXISTING central vertical
// rib's own upper remnant, already produced by frameEngine.ts's addVerticals
// (its cutRange cuts that rib through exactly the circle's vertical span,
// instead of truncating it above `low` the way the rect cutout does — a
// rect cutout has no "reconnect above" because its own side bars already
// reach the mouth; the round opening has no side bars, so that same central
// rib (cut, not replaced) is what bridges the gap instead.
function computeRoundCutoutPaths(top: Section, samples: Sample[], handle: HandleInput): THREE.Vector3[][] {
  const paths: THREE.Vector3[][] = [];
  const mouthZ = top.zMm;
  const offset = Math.max(handle.cutoutOffset, 0);
  const diameter = Math.max(handle.cutoutWidth, 10);
  const radius = diameter / 2;
  const zTop = mouthZ - offset;
  const zCenter = zTop - radius;
  const segments = 48;

  for (let side = 0; side < 2; side++) {
    const center = side === 0 ? 0 : Math.PI;

    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (2 * Math.PI * i) / segments;
      const x = radius * Math.cos(theta);
      const z = zCenter + radius * Math.sin(theta);
      ring.push(surfacePointAtLocalChord(samples, z, center, x));
    }
    paths.push(ring);
  }
  return paths;
}

// One path per physical member (2 sides x N lines for standing, or the
// left/right/lower[/upper] bars per side for cutout). Each path is a plain
// point list — the caller decides whether to sweep it into a steel tube
// (FrameEngine) or draw it as a thin guide line (Solid view).
export function computeHandlePaths(top: Section, samples: Sample[], handle: HandleInput): THREE.Vector3[][] {
  if (handle.type === "none") return [];
  if (handle.type === "cutout") {
    return handle.cutoutShape === "round" ? computeRoundCutoutPaths(top, samples, handle) : computeCutoutPaths(top, samples, handle);
  }
  return computeStandingPaths(top, handle);
}

// A cutout handle removes the middle section of whichever vertical rib
// sits exactly at the centre of each opening (angle 0 and angle π) — see
// FrameEngine's cutout_central_rib?
export function cutoutCentralRib(index: number, count: number): boolean {
  if (count < 2) return false;
  const target = count / 2;
  return index === 0 || Math.abs(index - target) < 0.5;
}

// Clips a polyline to the portion where Z falls between zLow/zHigh,
// interpolating new points at the boundaries — port of Ruby's
// path_slice_between_z, used to shorten the cutout's central rib down to
// just the segment below the opening.
export function pathSliceBetweenZ(points: THREE.Vector3[], zLow: number, zHigh: number): THREE.Vector3[] {
  const lo = Math.min(zLow, zHigh);
  const hi = Math.max(zLow, zHigh);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const az = a.z;
    const bz = b.z;
    if (Math.max(az, bz) < lo - 0.0001 || Math.min(az, bz) > hi + 0.0001) continue;
    if (out.length === 0 || out[out.length - 1].distanceTo(a) > 0.001) {
      if (az >= lo - 0.0001 && az <= hi + 0.0001) out.push(a);
    }
    if ((az < lo && bz > lo) || (az > lo && bz < lo)) {
      const t = (lo - az) / (bz - az);
      out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, lo));
    }
    if ((az < hi && bz > hi) || (az > hi && bz < hi)) {
      const t = (hi - az) / (bz - az);
      out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, hi));
    }
    if (bz >= lo - 0.0001 && bz <= hi + 0.0001) out.push(b);
  }
  out.sort((p, q) => p.z - q.z);
  const deduped: THREE.Vector3[] = [];
  for (const p of out) {
    if (deduped.length === 0 || deduped[deduped.length - 1].distanceTo(p) > 0.001) deduped.push(p);
  }
  return deduped;
}
