// Steel frame for Oval — a "stadium" shape (2 straight sides + 2 full
// semicircular end caps, see ovalProfileEngine.ts). Ring generation reuses
// Rectangle's buildRoundedRectPoints2D (already shape-general at
// cornerR = width/2); vertical ribs and Đáy/Nắp parallel ribs use their own
// oval-native placement below (per the user's own spec), since Rectangle's
// edge/corner scheme assumes 4 real edges — an oval only has 2.
import * as THREE from "three";
import { num } from "./math";
import { pathSliceBetweenZ } from "./handlePaths";
import { buildRoundedRectPoints2D, DEFAULT_RECT_SEGMENTS_PER_CORNER, RECT_LID_DEFAULT_OVERHANG_MM } from "./rectProfileEngine";
import { computeOvalHandlePaths } from "./ovalHandlePaths";
import { buildOvalProfileSamples, halfPerimeterPoint, normalizeOvalRings, validateOvalSections, type OvalSample, type OvalSection } from "./ovalProfileEngine";
import { buildTubeGeometry } from "./tubeSweep";
import type { BomPart, FrameTube } from "./frameEngine";
import type { FrameInput, HandleInput, LidInput, OvalCorner, OvalFrameInput, OvalProfileInput } from "./types";

function sectionToCorner(s: OvalSection): OvalCorner {
  return { z: s.zMm, length: s.lengthMm, width: s.widthMm, cap: s.cap };
}

const COLOR_HEX: Record<string, string> = {
  beige: "#e3d0b0",
  black: "#2b2b2b",
  white: "#f0f0f0",
};

function pushTube(tubes: FrameTube[], pts: THREE.Vector3[], dia: number, opts?: { closed?: boolean; part?: BomPart }) {
  const geo = buildTubeGeometry(pts, dia, opts);
  if (geo) tubes.push({ geometry: geo, points: pts, closed: !!opts?.closed, diameterMm: dia, part: opts?.part });
}

// Same idea as frameEngine.ts's own pushVerticalOrSplit for Round's cutout
// handle: the rib sitting at the exact center of a cutout opening (here,
// always one of the 2 tip ribs — see verticalRibXY) gets shortened to just
// the segment below the opening instead of running straight through it.
function pushVerticalOrSplit(tubes: FrameTube[], pts: THREE.Vector3[], dia: number, cutBottom: number, part?: BomPart) {
  const segTop = Math.max(...pts.map((p) => p.z));
  const segBottom = Math.min(...pts.map((p) => p.z));
  if (segTop <= cutBottom + 0.001) {
    pushTube(tubes, pts, dia, { part });
    return;
  }
  if (segBottom >= cutBottom - 0.001) {
    return;
  }
  const lower = pathSliceBetweenZ(pts, segBottom, cutBottom);
  if (lower.length >= 2) pushTube(tubes, lower, dia, { part });
}

// Every FI field falls back the same way Round/Rect's own resolveDiameters
// does — rod diameter/color aren't shape-specific concepts.
function dia(frame: FrameInput, field: number | undefined): number {
  if (frame.diameterMode !== "custom") return Math.max(num(frame.sameDiameter, 4), 0.5);
  return Math.max(num(field, frame.sameDiameter), 0.5);
}

function ringPoints3D(length: number, width: number, z: number, segmentsPerCorner: number): THREE.Vector3[] {
  return buildRoundedRectPoints2D(length, width, width / 2, segmentsPerCorner).map(([x, y]) => new THREE.Vector3(x, y, z));
}

interface OvalRibPos {
  xy: (length: number, width: number) => [number, number];
  // Which cutout opening (at the +X or -X tip) this rib sits at the exact
  // center of, or null if it's not a tip rib — only tip ribs ever get
  // shortened for a cutout handle (see addOvalVerticals).
  tipSide: 1 | -1 | null;
}

// "fixed_tips": the 2 tip ribs (each end cap's own arc-center — the
// farthest point along the length axis) are ALWAYS present, fixed — per
// the user's spec, these aren't counted in bodyRibsPerHalf. The rest are
// spread evenly by real arc length across each of the 2 symmetric halves
// (mirrored across the length axis) — see halfPerimeterPoint.
//
// "even": no rib is forced onto the tips. bodyRibsPerQuarter ribs are
// placed evenly (by arc length, strictly inside the quarter — never AT
// t=0/0.5, so a count never accidentally lands one back on a tip) within
// ONE quarter [0, 0.5) of halfPerimeterPoint's own parametrization — from
// the +X tip up through its cap into the top straight side, stopping
// before the straight side's own midpoint — then mirrored to the other 3
// quarters (y → -y for top/bottom, t → 1-t for the -X end), so the 2
// straight sides are guaranteed identical to each other and the 2 end
// caps are too, rather than a plain continuous sweep around the whole
// loop that would only happen to respect that symmetry for select counts.
//
// Both modes return position FUNCTIONS (not fixed points) so the same rib
// set can be evaluated at both the mouth's and base's own length/width,
// matching how Rect's own verticalRibPositions works.
function verticalRibXY(frame: OvalFrameInput): OvalRibPos[] {
  if (frame.bodyRibMode === "even") {
    const perQuarter = Math.max(Math.round(frame.bodyRibsPerQuarter), 0);
    const fns: OvalRibPos[] = [];
    for (let i = 0; i < perQuarter; i++) {
      const t = ((i + 0.5) / perQuarter) * 0.5;
      fns.push({ xy: (length, width) => halfPerimeterPoint(length, width, t), tipSide: null });
      fns.push({
        xy: (length, width) => {
          const [x, y] = halfPerimeterPoint(length, width, t);
          return [x, -y];
        },
        tipSide: null,
      });
      fns.push({ xy: (length, width) => halfPerimeterPoint(length, width, 1 - t), tipSide: null });
      fns.push({
        xy: (length, width) => {
          const [x, y] = halfPerimeterPoint(length, width, 1 - t);
          return [x, -y];
        },
        tipSide: null,
      });
    }
    return fns;
  }

  const fns: OvalRibPos[] = [];
  fns.push({ xy: (length) => [length / 2, 0], tipSide: 1 });
  fns.push({ xy: (length) => [-length / 2, 0], tipSide: -1 });

  const n = Math.max(Math.round(frame.bodyRibsPerHalf), 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    fns.push({ xy: (length, width) => halfPerimeterPoint(length, width, t), tipSide: null });
    fns.push({
      xy: (length, width) => {
        const [x, y] = halfPerimeterPoint(length, width, t);
        return [x, -y];
      },
      tipSide: null,
    });
  }
  return fns;
}

// Follows the FULL dense bowed profile (every rib's fixed XY-role position,
// evaluated at each sample's own length/width) rather than a straight
// 2-point mouth→base line — same idea as Round's own "continuous" vertical
// mode (frameEngine.ts's addVerticals: `samples.map(([r,z]) => polarPoint(r,
// angle, z))`), so a rib genuinely bends to follow a belly/waist instead of
// cutting a straight line through it.
function addOvalVerticals(tubes: FrameTube[], samples: OvalSample[], ovalFrame: OvalFrameInput, handle: HandleInput, diameter: number) {
  const mouthZ = samples[0][2];
  const cutBottom = handle.type === "cutout" ? mouthZ - Math.max(handle.cutoutOffset, 0) - Math.max(handle.cutoutDepth, 5) : null;
  const part: BomPart = { group: "Thân", label: "Nan dọc" };

  for (const pos of verticalRibXY(ovalFrame)) {
    const pts = samples.map(([length, width, z]) => {
      const [x, y] = pos.xy(length, width);
      return new THREE.Vector3(x, y, z);
    });
    if (cutBottom !== null && pos.tipSide !== null) {
      pushVerticalOrSplit(tubes, pts, diameter, cutBottom, part);
    } else {
      pushTube(tubes, pts, diameter, { part });
    }
  }
}

// One frame tube per profile RING directly (mouth/base at their own exact
// dims, every middle ring pushed out/in by the rod+ring radius like Round's
// own addHorizontalRings does) — no interpolation needed since every ring
// is already a first-class section with its own length/width, unlike the
// old model where "vòng ngang" was a separate Z-only marker interpolated
// off mouth/base.
function addOvalHorizontalRings(tubes: FrameTube[], sections: OvalSection[], frame: FrameInput, segmentsPerCorner: number) {
  const rodDia = dia(frame, frame.verticalDiameter);
  let middleIndex = 0;
  sections.forEach((section, i) => {
    const isTop = i === 0;
    const isBottom = i === sections.length - 1;
    const ringDia = isTop ? dia(frame, frame.topDiameter) : isBottom ? dia(frame, frame.bottomRimDiameter) : dia(frame, frame.bodyDiameter);
    let length = section.lengthMm;
    let width = section.widthMm;
    if (!isTop && !isBottom) {
      const offset = (frame.ringPlacement === "outside" ? 1 : -1) * (rodDia / 2 + ringDia / 2);
      length += 2 * offset;
      width += 2 * offset;
    }
    const label = isTop ? "Đường miệng" : isBottom ? "Đường đáy" : `Đường ngang ${++middleIndex}`;
    pushTube(tubes, ringPoints3D(length, width, section.zMm, segmentsPerCorner), ringDia, { closed: true, part: { group: "Thân", label } });
  });
}

// Đáy/Nắp parallel ribs — same idea as Rectangle's own parallelRibLines
// (evenly stack ribs across the FULL entered length/width, each one
// clipped to the real boundary at its own position), but Rectangle's
// version deliberately confines the stacking positions to the straight
// remainder ONLY (hl-r / hw-r) — correct for Rect's small fillets, but
// wrong here: an oval's "hw-r" is exactly 0 (the whole width IS the cap),
// so that would collapse every rib onto a single center line. This spreads
// across the TRUE full span instead; boundaryX/boundaryY (the per-position
// clip) is otherwise the same formula, which already generalizes correctly
// to r = width/2.
function ovalParallelRibLines(length: number, width: number, direction: "length" | "width", count: number): [THREE.Vector2, THREE.Vector2][] {
  const hl = length / 2;
  const hw = width / 2;
  const r = hw;
  const n = Math.max(Math.round(count), 0); // 0 = "Không có" — bare rim ring only, no fill ribs
  const lines: [THREE.Vector2, THREE.Vector2][] = [];

  function boundaryX(y: number): number {
    const ay = Math.min(Math.abs(y), hw);
    return hl - r + Math.sqrt(Math.max(r * r - ay * ay, 0));
  }
  function boundaryY(x: number): number {
    const ax = Math.abs(x);
    if (ax <= hl - r) return hw;
    const dx = Math.min(ax - (hl - r), r);
    return Math.sqrt(Math.max(r * r - dx * dx, 0));
  }

  for (let idx = 0; idx < n; idx++) {
    const frac = (idx + 1) / (n + 1);
    if (direction === "length") {
      const y = -hw + 2 * hw * frac;
      const x = boundaryX(y);
      lines.push([new THREE.Vector2(-x, y), new THREE.Vector2(x, y)]);
    } else {
      const x = -hl + 2 * hl * frac;
      const y = boundaryY(x);
      lines.push([new THREE.Vector2(x, -y), new THREE.Vector2(x, y)]);
    }
  }
  return lines;
}

function addOvalBottom(tubes: FrameTube[], base: OvalCorner, ovalFrame: OvalFrameInput, diameter: number) {
  const lines = ovalParallelRibLines(base.length, base.width, ovalFrame.bottomDirection, ovalFrame.bottomCount);
  const part: BomPart = { group: "Đáy", label: "Nan đáy" };
  for (const [a, b] of lines) {
    pushTube(tubes, [new THREE.Vector3(a.x, a.y, base.z), new THREE.Vector3(b.x, b.y, base.z)], diameter, { part });
  }
}

function addOvalLid(tubes: FrameTube[], mouth: OvalCorner, lid: LidInput, frame: FrameInput, ovalFrame: OvalFrameInput, segmentsPerCorner: number) {
  const mode = lid.mode ?? "none";
  if (mode === "none") return;
  const height = Math.max(num(lid.height, 60), 0);
  const zTop = mouth.z + height;
  const ribDia = dia(frame, frame.lidParallelDiameter);

  const length = mode === "flat" ? Math.max(num(lid.length, mouth.length), 1) : Math.max(num(lid.length, mouth.length + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const width = mode === "flat" ? Math.max(num(lid.width, mouth.width), 1) : Math.max(num(lid.width, mouth.width + RECT_LID_DEFAULT_OVERHANG_MM), 1);

  const lines = ovalParallelRibLines(length, width, ovalFrame.lidDirection, ovalFrame.lidCount);
  const lidRibPart: BomPart = { group: "Nắp", label: mode === "flat" ? "Nan nắp" : "Nan nắp - mặt trên" };
  for (const [a, b] of lines) {
    pushTube(tubes, [new THREE.Vector3(a.x, a.y, zTop), new THREE.Vector3(b.x, b.y, zTop)], ribDia, { part: lidRibPart });
  }

  if (mode === "flat") {
    pushTube(tubes, ringPoints3D(length, width, zTop, segmentsPerCorner), dia(frame, frame.lidTopDiameter), {
      closed: true,
      part: { group: "Nắp", label: "Viền nắp" },
    });
    return;
  }

  const bottomLength = Math.max(num(lid.bottomLength, mouth.length + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  const bottomWidth = Math.max(num(lid.bottomWidth, mouth.width + RECT_LID_DEFAULT_OVERHANG_MM), 1);
  pushTube(tubes, ringPoints3D(bottomLength, bottomWidth, mouth.z, segmentsPerCorner), dia(frame, frame.lidBottomDiameter), {
    closed: true,
    part: { group: "Nắp", label: "Đường miệng" },
  });
  pushTube(tubes, ringPoints3D(length, width, zTop, segmentsPerCorner), dia(frame, frame.lidTopDiameter), {
    closed: true,
    part: { group: "Nắp", label: "Đường đáy" },
  });

  // Same body vertical-rib scheme, just swept between the lid's own bottom
  // ring (at the mouth) and its own top ring (at zTop) — per the user,
  // "nan ở thân cho nắp trùm dùng quy luật như thân". No cutout-shortening
  // here — a body cutout doesn't carve into the lid.
  const wallDia = dia(frame, frame.lidWallDiameter);
  const wallPart: BomPart = { group: "Nắp", label: "Nan nắp" };
  for (const pos of verticalRibXY(ovalFrame)) {
    const [bx, by] = pos.xy(bottomLength, bottomWidth);
    const [tx, ty] = pos.xy(length, width);
    pushTube(tubes, [new THREE.Vector3(bx, by, mouth.z), new THREE.Vector3(tx, ty, zTop)], wallDia, { part: wallPart });
  }
}

export interface OvalSteelFrameResult {
  tubes: FrameTube[];
  colorHex: string;
}

export function buildOvalSteelFrame(
  profile: OvalProfileInput,
  lid: LidInput,
  handle: HandleInput,
  frame: FrameInput,
  ovalFrame: OvalFrameInput,
  segmentsPerCorner = DEFAULT_RECT_SEGMENTS_PER_CORNER,
  // Same locked dense curve buildOvalSolid takes — keeps the frame's
  // vertical ribs bent to match the LOCKED shape instead of whatever the
  // (possibly since-repositioned) rings would bow to on their own.
  denseSamples?: OvalSample[],
): OvalSteelFrameResult {
  if (!profile.rings || profile.rings.length < 2) {
    throw new Error("Cần ít nhất 2 vòng để dựng khung.");
  }
  const sections = normalizeOvalRings(profile.rings);
  validateOvalSections(sections);
  const samples = denseSamples && denseSamples.length >= 2 ? denseSamples : buildOvalProfileSamples(profile.rings);
  const mouth = sections[0];
  const base = sections[sections.length - 1];

  const tubes: FrameTube[] = [];
  addOvalVerticals(tubes, samples, ovalFrame, handle, dia(frame, frame.verticalDiameter));
  addOvalHorizontalRings(tubes, sections, frame, segmentsPerCorner);
  addOvalBottom(tubes, sectionToCorner(base), ovalFrame, dia(frame, frame.bottomParallelDiameter));
  addOvalLid(tubes, sectionToCorner(mouth), lid, frame, ovalFrame, segmentsPerCorner);
  for (const pts of computeOvalHandlePaths(profile.rings, handle)) {
    pushTube(tubes, pts, dia(frame, frame.handleDiameter), { part: { group: "Quai", label: "Quai" } });
  }

  const colorHex = frame.colorPreset === "custom" ? frame.customColor || "#e3d0b0" : (COLOR_HEX[frame.colorPreset] ?? "#e3d0b0");
  return { tubes, colorHex };
}
