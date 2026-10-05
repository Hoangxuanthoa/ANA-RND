// Steel frame for Rectangle/Square — deliberately much simpler than Round's:
// no radial/curved patterns anywhere (per spec), just straight members.
import * as THREE from "three";
import { clamp, num } from "./math";
import { interpolateRectCorner, RECT_LID_DEFAULT_OVERHANG_MM } from "./rectProfileEngine";
import { computeRectHandlePaths } from "./rectHandlePaths";
import type { BomPart, FrameTube } from "./frameEngine";
import { buildTubeGeometry } from "./tubeSweep";
import type { FrameInput, HandleInput, LidInput, RectCorner, RectFrameInput, RectProfileInput } from "./types";

const COLOR_HEX: Record<string, string> = {
  beige: "#e3d0b0",
  black: "#2b2b2b",
  white: "#f0f0f0",
};

function pushTube(tubes: FrameTube[], pts: THREE.Vector3[], dia: number, opts?: { closed?: boolean; part?: BomPart }) {
  const geo = buildTubeGeometry(pts, dia, opts);
  if (geo) tubes.push({ geometry: geo, points: pts, closed: !!opts?.closed, diameterMm: dia, part: opts?.part });
}

// Every FI field falls back the same way Round's resolveDiameters does —
// reusing the SAME FrameInput fields (top/bottomRim/vertical/body/
// bottomParallel/lidParallel), since rod diameter + color aren't
// shape-specific concepts.
function dia(frame: FrameInput, field: number | undefined): number {
  if (frame.diameterMode !== "custom") return Math.max(num(frame.sameDiameter, 4), 0.5);
  return Math.max(num(field, frame.sameDiameter), 0.5);
}

// Corner arc centers/points share the exact same convention as
// rectProfileEngine's buildRoundedRectPoints2D (quadrant k sweeps
// [k*90°,(k+1)*90°], centered on the origin, X="chiều dài", Y="chiều rộng")
// — kept in sync deliberately so a rib computed here lands exactly on the
// body's own outline.
function cornerCenter(hl: number, hw: number, r: number, corner: number): [number, number] {
  const centers: [number, number][] = [
    [hl - r, hw - r],
    [-(hl - r), hw - r],
    [-(hl - r), -(hw - r)],
    [hl - r, -(hw - r)],
  ];
  return centers[corner];
}

function cornerPointAtLocalAngle(length: number, width: number, cornerR: number, corner: number, localAngle: number): [number, number] {
  const hl = length / 2;
  const hw = width / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  const [cx, cy] = cornerCenter(hl, hw, r, corner);
  const angle = corner * (Math.PI / 2) + localAngle;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

// The "mặt dài" (length-direction) edges sit at y = ±(half width), running
// in X between the two corners that border them. t=0..1 sweeps from the
// +X end to the -X end — always LANDING exactly on the corner tangent
// points at t=0/1, so an edge's own N-evenly-spaced ribs always include
// those 2 points by construction (never needs a separate "add the corner
// point" step).
function lengthEdgePoint(length: number, width: number, cornerR: number, side: 1 | -1, t: number): [number, number] {
  const hl = length / 2;
  const hw = width / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  const x = hl - r - 2 * (hl - r) * t;
  return [x, side * hw];
}

// The "mặt rộng" (width-direction) edges sit at x = ±(half length), same
// t=0..1 convention, running in Y.
function widthEdgePoint(length: number, width: number, cornerR: number, side: 1 | -1, t: number): [number, number] {
  const hl = length / 2;
  const hw = width / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  const y = hw - r - 2 * (hw - r) * t;
  return [side * hl, y];
}

// Point at fractional arc length t∈[0,1] along the UPPER half of the outline —
// from the +X mid-face (t=0, at y=0), up the right face, round the top-right
// corner, across the top face, round the top-left corner, and down the left
// face to the -X mid-face (t=1). The lower half is this mirrored (y → -y).
// Same parametrization as the Oval's halfPerimeterPoint, generalized to a
// rounded rectangle (whose straight faces the oval simply doesn't have on the
// short axis).
function halfPerimeterPoint(length: number, width: number, cornerR: number, t: number): [number, number] {
  const hl = length / 2;
  const hw = width / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  const side = hw - r; // each end face's straight half-run (y from 0 up to the corner)
  const quarter = (Math.PI / 2) * r;
  const top = 2 * (hl - r);
  const total = 2 * side + 2 * quarter + top;
  if (total < 0.0001) return [hl, 0];
  const s = Math.max(0, Math.min(1, t)) * total;
  const rr = Math.max(r, 0.0001);

  if (s <= side) return [hl, s];
  if (s <= side + quarter) {
    const theta = (s - side) / rr;
    return [hl - r + r * Math.cos(theta), hw - r + r * Math.sin(theta)];
  }
  if (s <= side + quarter + top) return [hl - r - (s - side - quarter), hw];
  if (s <= side + 2 * quarter + top) {
    const theta = Math.PI / 2 + (s - side - quarter - top) / rr;
    return [-(hl - r) + r * Math.cos(theta), hw - r + r * Math.sin(theta)];
  }
  return [-hl, side - (s - side - 2 * quarter - top)];
}

// One (x,y) position per rib, in the profile's own local coordinates — Z is
// resolved separately per-row since length/width/cornerR (and therefore
// every rib's x,y) change at each Z along a "Vòng ngang".
type RibXY = (length: number, width: number, cornerR: number) => [number, number];

// `onFace`/`localOffsetAtMouth` identify edge ribs that might need
// splitting for a cutout handle (see addVerticals) — `onFace` matches
// HandleInput.side's own vocabulary directly ("width" = ribs on the 2
// faces at x=±length/2, i.e. from widthEdgePoint; "length" = the mirror on
// y=±width/2, from lengthEdgePoint), `localOffsetAtMouth` is that rib's mm
// offset from its face's own center, evaluated at the mouth (where a
// cutout's width/offset are naturally measured from). Corner ribs are
// never split — null.
interface RibPosition {
  xy: RibXY;
  onFace: "length" | "width" | null;
  localOffsetAtMouth: number | null;
}

// Corner ribs and edge ribs are two fully INDEPENDENT sets now (confirmed
// with the user after an initial round that guaranteed edges always
// touched the corner tangent points — that reading was wrong): the corner
// mode alone decides what sits at each corner (1 = bisector only, 2 = the
// 2 tangent points only, 3 = all three), and an edge's own rib count is
// spaced ONLY across its own flat remainder — the straight portion left
// over once the 2 corner arcs are subtracted — never landing on the
// tangent points themselves (those belong exclusively to the corner set).
// Tags an arc-length rib (see perimeterRibPositions) with the face it sits on,
// judged at the mouth, so a cutout handle can still shorten the ribs that fall
// inside its opening. Ribs on a corner arc belong to no face.
function classifyAtMouth(xy: RibXY, mouth: RectCorner): Pick<RibPosition, "onFace" | "localOffsetAtMouth"> {
  const [x, y] = xy(mouth.length, mouth.width, mouth.cornerR);
  const hl = mouth.length / 2;
  const hw = mouth.width / 2;
  const r = Math.max(Math.min(mouth.cornerR, hl, hw), 0);
  const eps = 0.01;
  if (Math.abs(x) >= hl - eps && Math.abs(y) <= hw - r + eps) return { onFace: "width", localOffsetAtMouth: y };
  if (Math.abs(y) >= hw - eps && Math.abs(x) <= hl - r + eps) return { onFace: "length", localOffsetAtMouth: x };
  return { onFace: null, localOffsetAtMouth: null };
}

// The Oval's two arc-length layouts, ported (see RectBodyRibMode).
function perimeterRibPositions(frame: RectFrameInput, mouth: RectCorner): RibPosition[] {
  const make = (xy: RibXY): RibPosition => ({ xy, ...classifyAtMouth(xy, mouth) });
  const at = (t: number, mirrorY: boolean): RibXY => (l, w, r) => {
    const [x, y] = halfPerimeterPoint(l, w, r, t);
    return [x, mirrorY ? -y : y];
  };
  const out: RibPosition[] = [];
  if (frame.bodyRibMode === "even") {
    const perQuarter = Math.max(Math.round(frame.bodyRibsPerQuarter), 0);
    for (let i = 0; i < perQuarter; i++) {
      const t = ((i + 0.5) / perQuarter) * 0.5;
      for (const tt of [t, 1 - t]) {
        out.push(make(at(tt, false)));
        out.push(make(at(tt, true)));
      }
    }
    return out;
  }
  // fixed_tips: the 2 mid-face ribs, then N per half spaced evenly by arc length.
  out.push(make((l) => [l / 2, 0]));
  out.push(make((l) => [-l / 2, 0]));
  const n = Math.max(Math.round(frame.bodyRibsPerHalf), 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    out.push(make(at(t, false)));
    out.push(make(at(t, true)));
  }
  return out;
}

function verticalRibPositions(frame: RectFrameInput, mouth: RectCorner): RibPosition[] {
  if (frame.bodyRibMode === "fixed_tips" || frame.bodyRibMode === "even") return perimeterRibPositions(frame, mouth);
  const positions: RibPosition[] = [];
  const lengthCount = Math.max(Math.round(frame.lengthRibCount), 0);
  const widthCount = Math.max(Math.round(frame.widthRibCount), 0);

  for (const side of [1, -1] as const) {
    for (let i = 0; i < lengthCount; i++) {
      const t = (i + 1) / (lengthCount + 1); // strictly between the 2 tangent points
      // A "mặt dài" face runs along X, so a rib's offset from the face's own
      // center is its X (not the constant wall Y).
      const [offsetX] = lengthEdgePoint(mouth.length, mouth.width, mouth.cornerR, side, t);
      positions.push({ xy: (l, w, r) => lengthEdgePoint(l, w, r, side, t), onFace: "length", localOffsetAtMouth: offsetX });
    }
    for (let i = 0; i < widthCount; i++) {
      const t = (i + 1) / (widthCount + 1);
      // widthEdgePoint returns [wallX, offsetY] — the rib's along-the-face
      // offset (from the face's own center) is its Y component.
      const [, offsetOnFace] = widthEdgePoint(mouth.length, mouth.width, mouth.cornerR, side, t);
      positions.push({ xy: (l, w, r) => widthEdgePoint(l, w, r, side, t), onFace: "width", localOffsetAtMouth: offsetOnFace });
    }
  }

  for (let corner = 0; corner < 4; corner++) {
    if (frame.cornerRibMode === "bisector" || frame.cornerRibMode === "both") {
      positions.push({ xy: (l, w, r) => cornerPointAtLocalAngle(l, w, r, corner, Math.PI / 4), onFace: null, localOffsetAtMouth: null });
    }
    if (frame.cornerRibMode === "tangents" || frame.cornerRibMode === "both") {
      positions.push({ xy: (l, w, r) => cornerPointAtLocalAngle(l, w, r, corner, 0), onFace: null, localOffsetAtMouth: null });
      positions.push({ xy: (l, w, r) => cornerPointAtLocalAngle(l, w, r, corner, Math.PI / 2), onFace: null, localOffsetAtMouth: null });
    }
  }
  return positions;
}

// A cutout handle carves an opening into 2 opposite faces (HandleInput.side
// picks which pair) — any vertical rib that would run straight through
// that opening gets shortened to just the stub below it (base→cutout
// bottom), same idea as Round's "cut the central rib" but generalized to
// however many ribs the cutout width happens to span, not just a single
// hardcoded center one.
function addVerticals(tubes: FrameTube[], profile: RectProfileInput, frame: RectFrameInput, handle: HandleInput, diameter: number) {
  const { mouth, base } = profile;
  const cutout = handle.type === "cutout" ? handle : null;
  const halfW = cutout ? Math.max(cutout.cutoutWidth, 10) / 2 : 0;
  const zLower = cutout ? mouth.z - Math.max(cutout.cutoutOffset, 0) - Math.max(cutout.cutoutDepth, 5) : 0;
  const part: BomPart = { group: "Thân", label: "Nan dọc" };

  for (const pos of verticalRibPositions(frame, mouth)) {
    const [mx, my] = pos.xy(mouth.length, mouth.width, mouth.cornerR);
    const [bx, by] = pos.xy(base.length, base.width, base.cornerR);
    const inCutout = cutout && pos.onFace === cutout.side && pos.localOffsetAtMouth !== null && Math.abs(pos.localOffsetAtMouth) <= halfW;

    if (inCutout) {
      const t = (mouth.z - zLower) / (mouth.z - base.z);
      const ix = mx + (bx - mx) * t;
      const iy = my + (by - my) * t;
      pushTube(tubes, [new THREE.Vector3(bx, by, base.z), new THREE.Vector3(ix, iy, zLower)], diameter, { part });
    } else {
      pushTube(tubes, [new THREE.Vector3(mx, my, mouth.z), new THREE.Vector3(bx, by, base.z)], diameter, { part });
    }
  }
}

function roundedRectRingPoints(length: number, width: number, cornerR: number, z: number, segmentsPerCorner: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let corner = 0; corner < 4; corner++) {
    for (let i = 0; i <= segmentsPerCorner; i++) {
      const [x, y] = cornerPointAtLocalAngle(length, width, cornerR, corner, (Math.PI / 2) * (i / segmentsPerCorner));
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}

function ringPointsAt(mouth: RectCorner, base: RectCorner, z: number, segmentsPerCorner: number): THREE.Vector3[] {
  const { length, width, cornerR } = interpolateRectCorner(mouth, base, z);
  return roundedRectRingPoints(length, width, cornerR, z, segmentsPerCorner);
}

// Growing/shrinking a rounded rect by a fixed distance is exact (not an
// approximation): the corner centers (hl-r, hw-r) stay put when hl and r
// change by the same amount, so this is a true parallel offset, same idea
// as Round's own ringPlacement (radius ± rodDia/2 ± ringDia/2).
function offsetRoundedRect(length: number, width: number, cornerR: number, offset: number): { length: number; width: number; cornerR: number } {
  return {
    length: Math.max(length + 2 * offset, 1),
    width: Math.max(width + 2 * offset, 1),
    cornerR: Math.max(cornerR + offset, 0),
  };
}

// Only the middle "Vòng ngang" rings get nudged in/out relative to the
// vertical ribs, same as Round — the mouth and base rings define the
// piece's own actual silhouette and always sit exactly at their entered
// size, regardless of ringPlacement.
function addHorizontalRings(tubes: FrameTube[], profile: RectProfileInput, frame: FrameInput, segmentsPerCorner: number) {
  const { mouth, base, horizontalRings } = profile;
  const rodDia = dia(frame, frame.verticalDiameter);
  const bodyDia = dia(frame, frame.bodyDiameter);
  const ringOffset = (frame.ringPlacement === "outside" ? 1 : -1) * (rodDia / 2 + bodyDia / 2);

  pushTube(tubes, ringPointsAt(mouth, base, mouth.z, segmentsPerCorner), dia(frame, frame.topDiameter), {
    closed: true,
    part: { group: "Thân", label: "Đường miệng" },
  });
  horizontalRings.forEach((ring, i) => {
    const nominal = interpolateRectCorner(mouth, base, ring.z);
    const { length, width, cornerR } = offsetRoundedRect(nominal.length, nominal.width, nominal.cornerR, ringOffset);
    pushTube(tubes, roundedRectRingPoints(length, width, cornerR, ring.z, segmentsPerCorner), bodyDia, {
      closed: true,
      part: { group: "Thân", label: `Đường ngang ${i + 1}` },
    });
  });
  pushTube(tubes, ringPointsAt(mouth, base, base.z, segmentsPerCorner), dia(frame, frame.bottomRimDiameter), {
    closed: true,
    part: { group: "Thân", label: "Đường đáy" },
  });
}

// The ONLY pattern for Đáy/Nắp per spec: straight parallel ribs, running
// along the chosen axis, evenly spaced across the OTHER axis. Same
// "subtract the corner segment, divide what's left evenly" rule the
// vertical edge ribs use: the stacking position never wanders into the
// corner-radius zone at either end (where the usable rib length tapers
// toward zero anyway) — it's spread across [-(half - r), (half - r)] with
// "(idx+1)/(count+1)" interior spacing, not the full [-half, half] span.
// Each individual rib is still clipped to the rounded-rect boundary along
// its own length, same as before.
function parallelRibLines(length: number, width: number, cornerR: number, direction: "length" | "width", count: number): [THREE.Vector2, THREE.Vector2][] {
  const hl = length / 2;
  const hw = width / 2;
  const r = Math.max(Math.min(cornerR, hl, hw), 0);
  const n = clamp(count, 0, 96); // 0 = "Không có" — bare rim ring only, no fill ribs
  const lines: [THREE.Vector2, THREE.Vector2][] = [];

  function boundaryX(y: number): number {
    const ay = Math.abs(y);
    if (ay <= hw - r) return hl;
    const dy = ay - (hw - r);
    return hl - r + Math.sqrt(Math.max(r * r - dy * dy, 0));
  }
  function boundaryY(x: number): number {
    const ax = Math.abs(x);
    if (ax <= hl - r) return hw;
    const dx = ax - (hl - r);
    return hw - r + Math.sqrt(Math.max(r * r - dx * dx, 0));
  }

  for (let idx = 0; idx < n; idx++) {
    const frac = (idx + 1) / (n + 1);
    if (direction === "length") {
      // Ribs run along X, stacked across Y ∈ [-(hw-r), hw-r].
      const y = -(hw - r) + 2 * (hw - r) * frac;
      const x = boundaryX(y);
      lines.push([new THREE.Vector2(-x, y), new THREE.Vector2(x, y)]);
    } else {
      // Ribs run along Y, stacked across X ∈ [-(hl-r), hl-r].
      const x = -(hl - r) + 2 * (hl - r) * frac;
      const y = boundaryY(x);
      lines.push([new THREE.Vector2(x, -y), new THREE.Vector2(x, y)]);
    }
  }
  return lines;
}

function addBottom(tubes: FrameTube[], base: RectCorner, frame: RectFrameInput, diameter: number) {
  const lines = parallelRibLines(base.length, base.width, base.cornerR, frame.bottomDirection, frame.bottomCount);
  const part: BomPart = { group: "Đáy", label: "Nan đáy" };
  for (const [a, b] of lines) {
    pushTube(tubes, [new THREE.Vector3(a.x, a.y, base.z), new THREE.Vector3(b.x, b.y, base.z)], diameter, { part });
  }
}

// Reuses the SAME defaults the Solid's own buildRectLidGeometry falls back
// to (flat: the lid's own length/width = the mouth's; cover: both the top
// AND bottom default to mouth size + RECT_LID_DEFAULT_OVERHANG_MM) — see
// rectProfileEngine.ts. Draws an outer border ring around the lid plate
// itself (a bare parallel-rib pattern with no enclosing ring reads as
// floating disconnected sticks, not a lid) — flat gets one ring at its own
// perimeter; cover gets one at each end of its skirt, same as Round's
// addLid.
function addLid(tubes: FrameTube[], mouth: RectCorner, lid: LidInput, frame: FrameInput, rectFrame: RectFrameInput, segmentsPerCorner: number) {
  const mode = lid.mode ?? "none";
  if (mode === "none") return;
  const cornerR = Math.max(num(lid.cornerR, mouth.cornerR), 0);
  const height = Math.max(num(lid.height, 60), 0);
  const zTop = mouth.z + height;
  const ribDia = dia(frame, frame.lidParallelDiameter);

  const length =
    mode === "flat" ? Math.max(num(lid.length, mouth.length), 1) : Math.max(num(lid.length, mouth.length + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const width =
    mode === "flat" ? Math.max(num(lid.width, mouth.width), 1) : Math.max(num(lid.width, mouth.width + RECT_LID_DEFAULT_OVERHANG_MM), 1);

  const lines = parallelRibLines(length, width, cornerR, rectFrame.lidDirection, rectFrame.lidCount);
  const lidRibPart: BomPart = { group: "Nắp", label: mode === "flat" ? "Nan nắp" : "Nan nắp - mặt trên" };
  for (const [a, b] of lines) {
    pushTube(tubes, [new THREE.Vector3(a.x, a.y, zTop), new THREE.Vector3(b.x, b.y, zTop)], ribDia, { part: lidRibPart });
  }

  if (mode === "flat") {
    pushTube(tubes, roundedRectRingPoints(length, width, cornerR, zTop, segmentsPerCorner), dia(frame, frame.lidTopDiameter), {
      closed: true,
      part: { group: "Nắp", label: "Viền nắp" },
    });
    return;
  }

  const bottomLength = Math.max(num(lid.bottomLength, mouth.length + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const bottomWidth = Math.max(num(lid.bottomWidth, mouth.width + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  pushTube(tubes, roundedRectRingPoints(bottomLength, bottomWidth, cornerR, mouth.z, segmentsPerCorner), dia(frame, frame.lidBottomDiameter), {
    closed: true,
    part: { group: "Nắp", label: "Đường miệng" },
  });
  pushTube(tubes, roundedRectRingPoints(length, width, cornerR, zTop, segmentsPerCorner), dia(frame, frame.lidTopDiameter), {
    closed: true,
    part: { group: "Nắp", label: "Đường đáy" },
  });

  // Same corner/edge vertical-rib system as the main body (verticalRibPositions)
  // — reused unchanged, just swept between the lid's own bottom ring (at the
  // mouth) and its own top ring (at zTop) instead of the body's mouth/base.
  const wallDia = dia(frame, frame.lidWallDiameter);
  const wallPart: BomPart = { group: "Nắp", label: "Nan nắp" };
  for (const pos of verticalRibPositions(rectFrame, mouth)) {
    const [bx, by] = pos.xy(bottomLength, bottomWidth, cornerR);
    const [tx, ty] = pos.xy(length, width, cornerR);
    pushTube(tubes, [new THREE.Vector3(bx, by, mouth.z), new THREE.Vector3(tx, ty, zTop)], wallDia, { part: wallPart });
  }
}

export interface RectSteelFrameResult {
  tubes: FrameTube[];
  colorHex: string;
}

export function buildRectSteelFrame(
  profile: RectProfileInput,
  lid: LidInput,
  handle: HandleInput,
  frame: FrameInput,
  rectFrame: RectFrameInput,
  segmentsPerCorner = 8,
): RectSteelFrameResult {
  if (Math.abs(profile.mouth.z - profile.base.z) < 0.001) {
    throw new Error("Miệng và Đáy không được trùng cao độ.");
  }
  const tubes: FrameTube[] = [];
  addVerticals(tubes, profile, rectFrame, handle, dia(frame, frame.verticalDiameter));
  addHorizontalRings(tubes, profile, frame, segmentsPerCorner);
  addBottom(tubes, profile.base, rectFrame, dia(frame, frame.bottomParallelDiameter));
  addLid(tubes, profile.mouth, lid, frame, rectFrame, segmentsPerCorner);
  for (const pts of computeRectHandlePaths(profile.mouth, profile.base, handle)) {
    pushTube(tubes, pts, dia(frame, frame.handleDiameter), { part: { group: "Quai", label: "Quai" } });
  }

  const colorHex = frame.colorPreset === "custom" ? frame.customColor || "#e3d0b0" : (COLOR_HEX[frame.colorPreset] ?? "#e3d0b0");
  return { tubes, colorHex };
}
