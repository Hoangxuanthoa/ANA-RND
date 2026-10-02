// Rectangle/Square body: unlike Round, there is no bow/curve option at all
// — each side wall is ONE flat plane running straight from the mouth rect
// to the base rect ("đứng" when mouth/base match, "vát" when they differ).
// A "Vòng ngang" therefore never bends the body surface; it only marks an
// extra Z for the Steel Frame (rectFrameEngine.ts) to hang a horizontal
// ring / vertical-rib bend point on. That means the SOLID only ever needs
// two rows — mouth and base — lofted directly into a frustum.
import * as THREE from "three";
import { num } from "./math";
import { DEFAULT_HANDLE, type HandleInput, type LidInput, type RectCorner, type RectProfileInput } from "./types";
import type { LidGeometry, SolidLike } from "./profileEngine";

export const DEFAULT_RECT_SEGMENTS_PER_CORNER = 8;

// Rounded-rectangle perimeter in the XY plane (X = "chiều dài", Y = "chiều
// rộng"), centered at the origin, going counter-clockwise starting at the
// tangent point on the +X edge. ALWAYS returns 4*(segmentsPerCorner+1)
// points regardless of cornerR (a sharp corner just repeats its point,
// rather than collapsing to fewer points) — callers that loft this against
// another row (mouth vs base, possibly a different cornerR) rely on both
// rows having the exact same point count, index-for-index.
export function buildRoundedRectPoints2D(length: number, width: number, cornerR: number, segmentsPerCorner = DEFAULT_RECT_SEGMENTS_PER_CORNER): [number, number][] {
  const hl = Math.max(length, 0.001) / 2;
  const hw = Math.max(width, 0.001) / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  // Corner arc centers, one per quadrant — quadrant k sweeps angle
  // [k*90°, (k+1)*90°], starting at the +X/+Y corner (k=0) and going CCW.
  const centers: [number, number][] = [
    [hl - r, hw - r],
    [-(hl - r), hw - r],
    [-(hl - r), -(hw - r)],
    [hl - r, -(hw - r)],
  ];
  const points: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const [cx, cy] = centers[k];
    const startAngle = (k * Math.PI) / 2;
    for (let i = 0; i <= segmentsPerCorner; i++) {
      const angle = startAngle + (Math.PI / 2) * (i / segmentsPerCorner);
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  return points;
}

// 0 at the mouth, 1 at the base — NOT clamped, so a Z above the mouth (or
// below the base) still gives the linear extrapolation of that same taper
// line, which is exactly what "Theo độ vát" handle leaning needs (see
// rectHandlePaths.ts): the body's side is one flat plane, so that line
// genuinely continues straight past the mouth, not just approximately.
function rectCornerT(mouth: RectCorner, base: RectCorner, z: number): number {
  const span = mouth.z - base.z;
  return Math.abs(span) < 0.001 ? 0 : (mouth.z - z) / span;
}

// Body length/width/cornerR at an arbitrary Z, linearly interpolated
// between the mouth and base corners — the whole side is one flat plane,
// so this is exact (not an approximation), and it's what a "Vòng ngang"'s
// entered Z resolves to for the Steel Frame.
export function interpolateRectCorner(mouth: RectCorner, base: RectCorner, z: number): { length: number; width: number; cornerR: number } {
  const clamped = Math.max(0, Math.min(1, rectCornerT(mouth, base, z)));
  return {
    length: mouth.length + (base.length - mouth.length) * clamped,
    width: mouth.width + (base.width - mouth.width) * clamped,
    cornerR: mouth.cornerR + (base.cornerR - mouth.cornerR) * clamped,
  };
}

// Half the length (or width) at an arbitrary Z, extrapolating PAST the
// mouth when z > mouth.z — the "đường thẳng kéo dài từ đáy lên miệng và
// kéo dài lên" a "taper" handle's apex sits on.
export function extrapolateRectHalfExtent(mouth: RectCorner, base: RectCorner, z: number, axis: "length" | "width"): number {
  const t = rectCornerT(mouth, base, z);
  const mVal = axis === "length" ? mouth.length : mouth.width;
  const bVal = axis === "length" ? base.length : base.width;
  return (mVal + (bVal - mVal) * t) / 2;
}

// Same perimeter as buildRoundedRectPoints2D, but with 2 extra points
// spliced into EACH of the 2 opposite edges matching `gapAxis` (at
// ±gapHalfWidth from that edge's own center) — used only for a cutout
// handle's body hole. Every row (mouth/zUpper/zLower/base) gets the SAME
// extra points at the SAME array positions regardless of whether that row
// actually has a hole (see buildRectBodyGeometryWithCutout) — that keeps
// every row's point count and per-index correspondence identical, so nothing
// twists the way row-to-row angular mismatches did for the scallop rim
// earlier in this project; only the QUADS between those 2 points ever get
// skipped, and only for the band between zUpper and zLower.
function buildRoundedRectPointsWithGap2D(
  length: number,
  width: number,
  cornerR: number,
  segmentsPerCorner: number,
  gapAxis: "length" | "width",
  gapHalfWidth: number,
): { points: [number, number][]; gapStartIndices: number[] } {
  const hl = Math.max(length, 0.001) / 2;
  const hw = Math.max(width, 0.001) / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  const centers: [number, number][] = [
    [hl - r, hw - r],
    [-(hl - r), hw - r],
    [-(hl - r), -(hw - r)],
    [hl - r, -(hw - r)],
  ];
  const points: [number, number][] = [];
  const gapStartIndices: number[] = [];

  function pushCorner(k: number) {
    const [cx, cy] = centers[k];
    const startAngle = (k * Math.PI) / 2;
    for (let i = 0; i <= segmentsPerCorner; i++) {
      const angle = startAngle + (Math.PI / 2) * (i / segmentsPerCorner);
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  // edgeType/edgeIndex identify, in perimeter-walk order: 0=TOP (length,
  // after corner0), 1=LEFT (width, after corner1), 2=BOTTOM (length, after
  // corner2), 3=RIGHT (width, after corner3, wrapping to corner0) — each
  // pair of points already runs in the SAME direction the perimeter walk
  // does along that edge (verified against each corner's own start/end).
  function pushEdgeGap(edgeType: "length" | "width", edgeIndex: 0 | 1 | 2 | 3) {
    if (edgeType !== gapAxis) return;
    gapStartIndices.push(points.length);
    if (edgeIndex === 0) {
      points.push([gapHalfWidth, hw], [-gapHalfWidth, hw]);
    } else if (edgeIndex === 1) {
      points.push([-hl, gapHalfWidth], [-hl, -gapHalfWidth]);
    } else if (edgeIndex === 2) {
      points.push([-gapHalfWidth, -hw], [gapHalfWidth, -hw]);
    } else {
      points.push([hl, -gapHalfWidth], [hl, gapHalfWidth]);
    }
  }

  pushCorner(0);
  pushEdgeGap("length", 0);
  pushCorner(1);
  pushEdgeGap("width", 1);
  pushCorner(2);
  pushEdgeGap("length", 2);
  pushCorner(3);
  pushEdgeGap("width", 3);

  return { points, gapStartIndices };
}

// A real opening carved into 2 opposite faces (HandleInput.side picks
// which pair) — structural port of Round's buildBodyGeometryWithCutout:
// 4 rows (mouth, cutout top, cutout bottom, base) instead of Round's
// "insert 2 extra Z samples," and the hole itself is just 2 skipped quads
// (one per affected face) in the zUpper→zLower band, since a flat wall's
// gap boundary is a straight line needing only its 2 endpoints — Round
// needs a curved multi-point arc there because its wall is circular.
function buildRectBodyGeometryWithCutout(mouth: RectCorner, base: RectCorner, handle: HandleInput, segmentsPerCorner: number): THREE.BufferGeometry {
  const mouthZ = mouth.z;
  const offset = Math.max(handle.cutoutOffset, 0);
  const depth = Math.max(handle.cutoutDepth, 5);
  const gapHalfWidth = Math.max(handle.cutoutWidth, 10) / 2;
  const zUpper = Math.min(mouthZ - offset, mouthZ);
  const zLower = Math.max(zUpper - depth, base.z + 0.001);
  const gapAxis = handle.side;

  const rows: Array<{ z: number; length: number; width: number; cornerR: number }> = [
    { z: mouthZ, length: mouth.length, width: mouth.width, cornerR: mouth.cornerR },
    { z: zUpper, ...interpolateRectCorner(mouth, base, zUpper) },
    { z: zLower, ...interpolateRectCorner(mouth, base, zLower) },
    { z: base.z, length: base.length, width: base.width, cornerR: base.cornerR },
  ];

  let gapStartIndices: number[] = [];
  const rowPoints = rows.map((row) => {
    const built = buildRoundedRectPointsWithGap2D(row.length, row.width, row.cornerR, segmentsPerCorner, gapAxis, gapHalfWidth);
    gapStartIndices = built.gapStartIndices; // identical for every row — same gapAxis/gapHalfWidth throughout
    return built.points;
  });

  const n = rowPoints[0].length;
  const positions: number[] = [];
  rowPoints.forEach((pts, i) => pts.forEach(([x, y]) => positions.push(x, y, rows[i].z)));

  const indices: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const isBand = i === 1; // zUpper → zLower is the only strip with an actual hole
    for (let j = 0; j < n; j++) {
      if (isBand && gapStartIndices.includes(j)) continue; // the one quad spanning this face's gap
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

// Exported for reuse by ovalProfileEngine.ts's own (non-cutout) body loft —
// a plain mouth→base quad strip between 2 point rows is already fully
// shape-general (it never reads cornerR, just X/Y/Z), so an oval body
// doesn't need its own copy.
export function buildRectBodyGeometry(mouthPts: [number, number][], mouthZ: number, basePts: [number, number][], baseZ: number): THREE.BufferGeometry {
  const n = mouthPts.length;
  const positions: number[] = [];
  mouthPts.forEach(([x, y]) => positions.push(x, y, mouthZ));
  basePts.forEach(([x, y]) => positions.push(x, y, baseZ));

  const indices: number[] = [];
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    const a = j;
    const b = k;
    const c = n + k;
    const d = n + j;
    indices.push(a, b, c, a, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildRectCapGeometry(pts2D: [number, number][], z: number): THREE.BufferGeometry {
  const positions: number[] = [];
  pts2D.forEach(([x, y]) => positions.push(x, y, z));
  positions.push(0, 0, z); // centre vertex
  const centerIndex = pts2D.length;

  const indices: number[] = [];
  for (let i = 0; i < pts2D.length; i++) {
    const j = (i + 1) % pts2D.length;
    indices.push(centerIndex, i, j);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// mm — how much bigger than the body's own mouth the cover lid's "miệng
// nắp" (top) and "đáy nắp" (bottom) default to, on each side, when left
// unset — just enough overhang to slip over the mouth without the
// dramatic flare Round's "double the top" convention would give a
// straight-walled rect skirt. Shared with RectProfileForm.tsx so the form
// can show this resolved number directly instead of a placeholder.
export const RECT_LID_DEFAULT_OVERHANG_MM = 20;

// Lid modes match Round: none / flat (one independent top plate, raised by
// the lid height above the mouth) / cover (a skirt between a bottom ring at
// the mouth and a top ring at the lid's own height — both default to
// mouth size + RECT_LID_DEFAULT_OVERHANG_MM, independently editable, so a
// straight-walled skirt is the default rather than a tapered one). The
// lid's own corner rounding defaults to the body's mouth cornerR but is
// independently editable (lid.cornerR).
export function buildRectLidGeometry(mouth: RectCorner, lid: LidInput, segmentsPerCorner = DEFAULT_RECT_SEGMENTS_PER_CORNER): LidGeometry {
  const mode = lid.mode || "none";
  if (mode === "none") return {};

  const cornerR = Math.max(num(lid.cornerR, mouth.cornerR), 0);
  const topZ = mouth.z;
  const height = Math.max(num(lid.height, 60), 0);

  if (mode === "flat") {
    const length = Math.max(num(lid.length, mouth.length), 1);
    const width = Math.max(num(lid.width, mouth.width), 1);
    const pts = buildRoundedRectPoints2D(length, width, cornerR, segmentsPerCorner);
    return { top: buildRectCapGeometry(pts, topZ + height) };
  }

  const length = Math.max(num(lid.length, mouth.length + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const width = Math.max(num(lid.width, mouth.width + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const bottomLength = Math.max(num(lid.bottomLength, mouth.length + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const bottomWidth = Math.max(num(lid.bottomWidth, mouth.width + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const lowerPts = buildRoundedRectPoints2D(bottomLength, bottomWidth, cornerR, segmentsPerCorner);
  const upperPts = buildRoundedRectPoints2D(length, width, cornerR, segmentsPerCorner);

  const skirt = buildRectBodyGeometry(lowerPts, topZ, upperPts, topZ + height);
  const top = buildRectCapGeometry(upperPts, topZ + height);
  return { skirt, top };
}

export type RectSolidResult = SolidLike;

export function buildRectSolid(
  profile: RectProfileInput,
  lid: LidInput = {},
  handle: HandleInput = DEFAULT_HANDLE,
  segmentsPerCorner = DEFAULT_RECT_SEGMENTS_PER_CORNER,
): RectSolidResult {
  const { mouth, base } = profile;
  if (Math.abs(mouth.z - base.z) < 0.001) {
    throw new Error("Miệng và Đáy không được trùng cao độ.");
  }
  const basePts = buildRoundedRectPoints2D(base.length, base.width, base.cornerR, segmentsPerCorner);
  // A cutout handle carves a real opening straight into the body mesh — the
  // scallop's cutout handle does the same (mutually exclusive with other
  // mouth-shape features there); here it's just independent of everything
  // else, so it's a simple type check, not a priority rule.
  const body =
    handle.type === "cutout"
      ? buildRectBodyGeometryWithCutout(mouth, base, handle, segmentsPerCorner)
      : buildRectBodyGeometry(buildRoundedRectPoints2D(mouth.length, mouth.width, mouth.cornerR, segmentsPerCorner), mouth.z, basePts, base.z);
  const bottomCap = base.cap ? buildRectCapGeometry(basePts, base.z) : undefined;
  return { body, bottomCap, lid: buildRectLidGeometry(mouth, lid, segmentsPerCorner) };
}
