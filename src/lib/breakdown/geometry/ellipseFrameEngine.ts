// Steel frame for Ellipse — a TRUE ellipse cross-section, no straight
// sides anywhere (see ellipseProfileEngine.ts). Same 2 vertical-rib modes
// and Đáy/Nắp scheme as Oval (ovalFrameEngine.ts), just walking a genuinely
// smooth curve (numeric arc length) instead of arc+straight+arc — and the
// Đáy/Nắp boundary clip is actually SIMPLER here: an ellipse's boundary at
// a given x or y has a closed-form solution (y = ±b√(1−(x/a)²)), unlike
// Oval's own boundaryX/boundaryY which had to special-case a fully-
// consumed straight edge.
import * as THREE from "three";
import { num } from "./math";
import { pathSliceBetweenZ } from "./handlePaths";
import {
  buildEllipseProfileSamples,
  DEFAULT_ELLIPSE_SEGMENTS,
  ellipsePoints2D,
  halfPerimeterPoint,
  normalizeEllipseRings,
  validateEllipseSections,
  type EllipseSample,
  type EllipseSection,
} from "./ellipseProfileEngine";
import { computeEllipseHandlePaths } from "./ellipseHandlePaths";
import { buildTubeGeometry } from "./tubeSweep";
import type { BomPart, FrameTube } from "./frameEngine";
import type { EllipseCorner, EllipseFrameInput, EllipseProfileInput, FrameInput, HandleInput, LidInput } from "./types";

function sectionToCorner(s: EllipseSection): EllipseCorner {
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
// always one of the 2 vertex ribs — see verticalRibXY) gets shortened to
// just the segment below the opening instead of running straight through it.
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

function dia(frame: FrameInput, field: number | undefined): number {
  if (frame.diameterMode !== "custom") return Math.max(num(frame.sameDiameter, 4), 0.5);
  return Math.max(num(field, frame.sameDiameter), 0.5);
}

function ringPoints3D(length: number, width: number, z: number, segments: number): THREE.Vector3[] {
  return ellipsePoints2D(length, width, segments).map(([x, y]) => new THREE.Vector3(x, y, z));
}

interface EllipseRibPos {
  xy: (length: number, width: number) => [number, number];
  vertexSide: 1 | -1 | null;
}

// Mirrors ovalFrameEngine.ts's own verticalRibXY exactly (same 2 modes,
// same symmetry construction) — just calling this file's own
// halfPerimeterPoint (true elliptical arc length) instead of Oval's.
function verticalRibXY(frame: EllipseFrameInput): EllipseRibPos[] {
  if (frame.bodyRibMode === "even") {
    const perQuarter = Math.max(Math.round(frame.bodyRibsPerQuarter), 0);
    const fns: EllipseRibPos[] = [];
    for (let i = 0; i < perQuarter; i++) {
      const t = ((i + 0.5) / perQuarter) * 0.5;
      fns.push({ xy: (length, width) => halfPerimeterPoint(length, width, t), vertexSide: null });
      fns.push({
        xy: (length, width) => {
          const [x, y] = halfPerimeterPoint(length, width, t);
          return [x, -y];
        },
        vertexSide: null,
      });
      fns.push({ xy: (length, width) => halfPerimeterPoint(length, width, 1 - t), vertexSide: null });
      fns.push({
        xy: (length, width) => {
          const [x, y] = halfPerimeterPoint(length, width, 1 - t);
          return [x, -y];
        },
        vertexSide: null,
      });
    }
    return fns;
  }

  const fns: EllipseRibPos[] = [];
  fns.push({ xy: (length) => [length / 2, 0], vertexSide: 1 });
  fns.push({ xy: (length) => [-length / 2, 0], vertexSide: -1 });

  const n = Math.max(Math.round(frame.bodyRibsPerHalf), 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    fns.push({ xy: (length, width) => halfPerimeterPoint(length, width, t), vertexSide: null });
    fns.push({
      xy: (length, width) => {
        const [x, y] = halfPerimeterPoint(length, width, t);
        return [x, -y];
      },
      vertexSide: null,
    });
  }
  return fns;
}

// Follows the FULL dense bowed profile (every rib's fixed XY-role
// position, evaluated at each sample's own length/width) rather than a
// straight 2-point mouth→base line — see ovalFrameEngine.ts's own
// addOvalVerticals for the fuller rationale.
function addEllipseVerticals(tubes: FrameTube[], samples: EllipseSample[], ellipseFrame: EllipseFrameInput, handle: HandleInput, diameter: number) {
  const mouthZ = samples[0][2];
  const cutBottom = handle.type === "cutout" ? mouthZ - Math.max(handle.cutoutOffset, 0) - Math.max(handle.cutoutDepth, 5) : null;
  const part: BomPart = { group: "Thân", label: "Nan dọc" };

  for (const pos of verticalRibXY(ellipseFrame)) {
    const pts = samples.map(([length, width, z]) => {
      const [x, y] = pos.xy(length, width);
      return new THREE.Vector3(x, y, z);
    });
    if (cutBottom !== null && pos.vertexSide !== null) {
      pushVerticalOrSplit(tubes, pts, diameter, cutBottom, part);
    } else {
      pushTube(tubes, pts, diameter, { part });
    }
  }
}

// One frame tube per profile RING directly — no interpolation needed since
// every ring is already a first-class section with its own length/width —
// see ovalFrameEngine.ts's own addOvalHorizontalRings for the fuller
// rationale (mirrors Round's own addHorizontalRings).
function addEllipseHorizontalRings(tubes: FrameTube[], sections: EllipseSection[], frame: FrameInput, segments: number) {
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
    pushTube(tubes, ringPoints3D(length, width, section.zMm, segments), ringDia, { closed: true, part: { group: "Thân", label } });
  });
}

// Đáy/Nắp parallel ribs — same "evenly stack across the FULL entered
// length/width, each clipped to the real boundary" idea as
// ovalParallelRibLines, but genuinely simpler here: an ellipse's boundary
// at a given x or y has a closed-form solution, no degenerate
// "straight edge fully consumed" case to work around.
function ellipseParallelRibLines(length: number, width: number, direction: "length" | "width", count: number): [THREE.Vector2, THREE.Vector2][] {
  const a = length / 2;
  const b = width / 2;
  const n = Math.max(Math.round(count), 0); // 0 = "Không có" — bare rim ring only, no fill ribs
  const lines: [THREE.Vector2, THREE.Vector2][] = [];

  for (let idx = 0; idx < n; idx++) {
    const frac = (idx + 1) / (n + 1);
    if (direction === "length") {
      const y = -b + 2 * b * frac;
      const x = a * Math.sqrt(Math.max(1 - (y / b) ** 2, 0));
      lines.push([new THREE.Vector2(-x, y), new THREE.Vector2(x, y)]);
    } else {
      const x = -a + 2 * a * frac;
      const y = b * Math.sqrt(Math.max(1 - (x / a) ** 2, 0));
      lines.push([new THREE.Vector2(x, -y), new THREE.Vector2(x, y)]);
    }
  }
  return lines;
}

function addEllipseBottom(tubes: FrameTube[], base: EllipseCorner, ellipseFrame: EllipseFrameInput, diameter: number) {
  const lines = ellipseParallelRibLines(base.length, base.width, ellipseFrame.bottomDirection, ellipseFrame.bottomCount);
  const part: BomPart = { group: "Đáy", label: "Nan đáy" };
  for (const [a, b] of lines) {
    pushTube(tubes, [new THREE.Vector3(a.x, a.y, base.z), new THREE.Vector3(b.x, b.y, base.z)], diameter, { part });
  }
}

function addEllipseLid(tubes: FrameTube[], mouth: EllipseCorner, lid: LidInput, frame: FrameInput, ellipseFrame: EllipseFrameInput, segments: number) {
  const mode = lid.mode ?? "none";
  if (mode === "none") return;
  const height = Math.max(num(lid.height, 60), 0);
  const zTop = mouth.z + height;
  const ribDia = dia(frame, frame.lidParallelDiameter);
  const overhang = 20;

  const length = mode === "flat" ? Math.max(num(lid.length, mouth.length), 1) : Math.max(num(lid.length, mouth.length + overhang), 1);
  const width = mode === "flat" ? Math.max(num(lid.width, mouth.width), 1) : Math.max(num(lid.width, mouth.width + overhang), 1);

  const lines = ellipseParallelRibLines(length, width, ellipseFrame.lidDirection, ellipseFrame.lidCount);
  const lidRibPart: BomPart = { group: "Nắp", label: mode === "flat" ? "Nan nắp" : "Nan nắp - mặt trên" };
  for (const [a, b] of lines) {
    pushTube(tubes, [new THREE.Vector3(a.x, a.y, zTop), new THREE.Vector3(b.x, b.y, zTop)], ribDia, { part: lidRibPart });
  }

  if (mode === "flat") {
    pushTube(tubes, ringPoints3D(length, width, zTop, segments), dia(frame, frame.lidTopDiameter), {
      closed: true,
      part: { group: "Nắp", label: "Viền nắp" },
    });
    return;
  }

  const bottomLength = Math.max(num(lid.bottomLength, mouth.length + overhang), 1);
  const bottomWidth = Math.max(num(lid.bottomWidth, mouth.width + overhang), 1);
  pushTube(tubes, ringPoints3D(bottomLength, bottomWidth, mouth.z, segments), dia(frame, frame.lidBottomDiameter), {
    closed: true,
    part: { group: "Nắp", label: "Đường miệng" },
  });
  pushTube(tubes, ringPoints3D(length, width, zTop, segments), dia(frame, frame.lidTopDiameter), {
    closed: true,
    part: { group: "Nắp", label: "Đường đáy" },
  });

  const wallDia = dia(frame, frame.lidWallDiameter);
  const wallPart: BomPart = { group: "Nắp", label: "Nan nắp" };
  for (const pos of verticalRibXY(ellipseFrame)) {
    const [bx, by] = pos.xy(bottomLength, bottomWidth);
    const [tx, ty] = pos.xy(length, width);
    pushTube(tubes, [new THREE.Vector3(bx, by, mouth.z), new THREE.Vector3(tx, ty, zTop)], wallDia, { part: wallPart });
  }
}

export interface EllipseSteelFrameResult {
  tubes: FrameTube[];
  colorHex: string;
}

export function buildEllipseSteelFrame(
  profile: EllipseProfileInput,
  lid: LidInput,
  handle: HandleInput,
  frame: FrameInput,
  ellipseFrame: EllipseFrameInput,
  segments = DEFAULT_ELLIPSE_SEGMENTS,
  // Same locked dense curve buildEllipseSolid takes — keeps the frame's
  // vertical ribs bent to match the LOCKED shape.
  denseSamples?: EllipseSample[],
): EllipseSteelFrameResult {
  if (!profile.rings || profile.rings.length < 2) {
    throw new Error("Cần ít nhất 2 vòng để dựng khung.");
  }
  const sections = normalizeEllipseRings(profile.rings);
  validateEllipseSections(sections);
  const samples = denseSamples && denseSamples.length >= 2 ? denseSamples : buildEllipseProfileSamples(profile.rings);
  const mouth = sections[0];
  const base = sections[sections.length - 1];

  const tubes: FrameTube[] = [];
  addEllipseVerticals(tubes, samples, ellipseFrame, handle, dia(frame, frame.verticalDiameter));
  addEllipseHorizontalRings(tubes, sections, frame, segments);
  addEllipseBottom(tubes, sectionToCorner(base), ellipseFrame, dia(frame, frame.bottomParallelDiameter));
  addEllipseLid(tubes, sectionToCorner(mouth), lid, frame, ellipseFrame, segments);
  for (const pts of computeEllipseHandlePaths(profile.rings, handle)) {
    pushTube(tubes, pts, dia(frame, frame.handleDiameter), { part: { group: "Quai", label: "Quai" } });
  }

  const colorHex = frame.colorPreset === "custom" ? frame.customColor || "#e3d0b0" : (COLOR_HEX[frame.colorPreset] ?? "#e3d0b0");
  return { tubes, colorHex };
}
