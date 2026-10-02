// Rectangle/Square standing handle. Reuses Round's own curvedHandlePoints /
// squareHandlePoints unchanged — they already work purely in a local
// (radial, tangent, z) basis, so pointing "radial" straight along +X/-X or
// +Y/-Y (instead of a circle's outward direction) sweeps a handle off a
// FLAT wall exactly as well as off a circular one. The only real
// difference from Round is what "baseR"/"apexR" (here: the wall's own
// half-extent) resolve to — see leanMode "taper" below.
import * as THREE from "three";
import { curvedHandlePoints, squareHandlePoints } from "./handlePaths";
import { extrapolateRectHalfExtent } from "./rectProfileEngine";
import type { HandleInput, RectCorner } from "./types";

// Which physical axis a cutout/standing handle on `side` reads its wall
// position from — "width" (handle sits on the 2 faces at x=±length/2) reads
// the LENGTH taper; "length" (faces at y=±width/2) reads WIDTH. Shared by
// the standing handle above, the cutout below, and the vertical-rib
// splitting in rectFrameEngine.ts, so all three agree on the same wall.
export function rectHandleAxis(side: HandleInput["side"]): "length" | "width" {
  return side === "length" ? "width" : "length";
}

// The wall's own half-extent at Z (tapering with the body — exact, not
// approximate, since the side is one flat plane) — i.e. the |X| (side
// "width") or |Y| (side "length") of that face at that height.
export function rectWallHalfExtentAtZ(mouth: RectCorner, base: RectCorner, z: number, side: HandleInput["side"]): number {
  return extrapolateRectHalfExtent(mouth, base, z, rectHandleAxis(side));
}

// A point ON one of the two cutout/standing-handle faces: `wallSide` picks
// +X/-X (side "width") or +Y/-Y (side "length"), `localOffset` is the
// position along that face's OTHER axis, measured from its own center.
export function rectWallPoint(mouth: RectCorner, base: RectCorner, z: number, side: HandleInput["side"], wallSide: 1 | -1, localOffset: number): THREE.Vector3 {
  const wallPos = wallSide * rectWallHalfExtentAtZ(mouth, base, z, side);
  return side === "width" ? new THREE.Vector3(wallPos, localOffset, z) : new THREE.Vector3(localOffset, wallPos, z);
}

// Local (offset, z) profile of the cutout's bottom bar — valley-to-valley
// same idea as Round's cutoutLowerBarPoints, just in the flat-wall's own
// (offset, z) plane instead of surface-following it: rounded corners (or a
// straight line, if the fillet doesn't fit) connecting the two side bars.
function cutoutLowerBarLocal(halfWidth: number, z: number, filletR: number, segments = 8): Array<[number, number]> {
  const r = Math.min(Math.max(filletR, 0), halfWidth * 0.45);
  if (r <= 0.001) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 20; i++) pts.push([-halfWidth + (2 * halfWidth * i) / 20, z]);
    return pts;
  }
  const pts: Array<[number, number]> = [];
  let cx = -halfWidth + r;
  const cz = z + r;
  for (let i = 0; i <= segments; i++) {
    const theta = Math.PI + (Math.PI * 0.5 * i) / segments;
    pts.push([cx + r * Math.cos(theta), cz + r * Math.sin(theta)]);
  }
  for (let i = 1; i <= 20; i++) {
    const x = -halfWidth + r + (2 * (halfWidth - r) * i) / 20;
    pts.push([x, z]);
  }
  cx = halfWidth - r;
  for (let i = 1; i <= segments; i++) {
    const theta = -Math.PI * 0.5 + (Math.PI * 0.5 * i) / segments;
    pts.push([cx + r * Math.cos(theta), cz + r * Math.sin(theta)]);
  }
  return pts;
}

// One member per physical bar: 2 side bars, 1 bottom bar (rounded corners),
// 1 top bar (drawn explicitly even at offset 0, so it reads as a real
// opening edge rather than two side bars merely touching the mouth ring at
// a point) — per face, ×2 faces. Direct structural port of Round's
// computeCutoutPaths (handlePaths.ts) onto a flat wall: no surface lookup
// needed, a "local chord" point is just (wallOffset, localOffset, z).
export function computeRectCutoutPaths(mouth: RectCorner, base: RectCorner, handle: HandleInput): THREE.Vector3[][] {
  const paths: THREE.Vector3[][] = [];
  if (handle.type !== "cutout") return paths;
  const mouthZ = mouth.z;
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const width = Math.max(handle.cutoutWidth, 10);
  const halfW = width / 2;
  const zUpper = mouthZ - offset;
  const zLower = zUpper - depth;
  const rBottom = Math.min(Math.max(handle.fillet, 0), halfW * 0.45, depth * 0.45);

  for (const wallSide of [1, -1] as const) {
    const point = (z: number, o: number) => rectWallPoint(mouth, base, z, handle.side, wallSide, o);

    const sideZs: number[] = [];
    for (let i = 0; i <= 18; i++) sideZs.push(zLower + rBottom + (mouthZ - (zLower + rBottom)) * (i / 18));
    const leftPts = sideZs.map((z) => point(z, -halfW));
    const rightPts = sideZs.map((z) => point(z, halfW));

    const lowerPts = cutoutLowerBarLocal(halfW, zLower, rBottom).map(([o, z]) => point(z, o));
    paths.push([lowerPts[0], ...leftPts.slice(1)]);
    paths.push([lowerPts[lowerPts.length - 1], ...rightPts.slice(1)]);
    paths.push(lowerPts);

    const upperPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) upperPts.push(point(zUpper, -halfW + (width * i) / 16));
    paths.push(upperPts);
  }
  return paths;
}

export function computeRectHandlePaths(mouth: RectCorner, base: RectCorner, handle: HandleInput): THREE.Vector3[][] {
  if (handle.type === "cutout") return computeRectCutoutPaths(mouth, base, handle);
  return computeRectStandingPaths(mouth, base, handle);
}

function computeRectStandingPaths(mouth: RectCorner, base: RectCorner, handle: HandleInput): THREE.Vector3[][] {
  const paths: THREE.Vector3[][] = [];
  if (handle.type !== "standing" || handle.height <= 0.001) return paths;

  // handleSide "width" = the handle sits on the two width-direction end
  // faces (x = ±half length) — so its base/apex offset is an X position
  // sized by LENGTH, and the extrapolation for "taper" reads the LENGTH
  // taper line. handleSide "length" is the mirror of this on Y/WIDTH.
  const extrapAxis = handle.side === "length" ? "width" : "length";
  const mouthHalfExtent = (handle.side === "length" ? mouth.width : mouth.length) / 2;
  const lines = handle.lines === 2 ? 2 : 1;

  for (const side of [1, -1] as const) {
    const centerAngle = handle.side === "width" ? (side === 1 ? 0 : Math.PI) : side === 1 ? Math.PI / 2 : -Math.PI / 2;
    for (let li = 0; li < lines; li++) {
      const inward = lines === 2 ? (li === 0 ? 0 : handle.offset) : 0;
      const innerWidth = Math.max(handle.width - 2 * inward, 10);
      const innerHeight = Math.max(handle.height - inward, 5);
      const baseOffset = mouthHalfExtent; // flat wall — no chord/radius reduction the way Round's circle needs
      const apexOffset =
        handle.leanMode === "vertical"
          ? baseOffset
          : handle.leanMode === "manual"
            ? baseOffset + Math.tan((handle.leanAngle * Math.PI) / 180) * innerHeight
            : extrapolateRectHalfExtent(mouth, base, mouth.z + innerHeight, extrapAxis); // "taper" (and the fallback for any other mode)

      const pts =
        handle.shape === "square"
          ? squareHandlePoints(centerAngle, baseOffset, apexOffset, mouth.z, innerHeight, innerWidth, handle.fillet)
          : curvedHandlePoints(centerAngle, baseOffset, apexOffset, mouth.z, innerWidth, innerHeight);
      paths.push(pts);
    }
  }
  return paths;
}
