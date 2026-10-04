// TypeScript port of ANASU's FrameEngine (src/geometry/frame_engine.rb).
import * as THREE from "three";
import { cutoutCentralRib, computeHandlePaths, pathSliceBetweenZ } from "./handlePaths";
import { clamp, num, sampleSliceBetweenZ } from "./math";
import { buildProfileSamples, normalizeRings, radiusAtZ, validateSections, type Sample } from "./profileEngine";
import {
  buildScallopPetalArch,
  buildScallopRingPointsFilleted,
  resolveScallopGeometry,
  scallopApexAngle,
  scallopValleyAngle,
  scallopZOffsetAtAngle,
  type ScallopGeometry,
} from "./scallopEngine";
import { DEFAULT_SCALLOP, type FrameInput, type HandleInput, type LidInput, type RingInput, type ScallopInput, type Section } from "./types";
import { buildTubeGeometry } from "./tubeSweep";

const RING_SEGMENTS = 48;

const COLOR_HEX: Record<string, string> = {
  beige: "#e3d0b0",
  black: "#2b2b2b",
  white: "#f0f0f0",
};

interface Diameters {
  top: number;
  body: number;
  bottomRim: number;
  vertical: number;
  bottomRadial: number;
  bottomCenterRing: number;
  bottomParallel: number;
  lidTop: number;
  lidWall: number;
  lidBottom: number;
  lidRadial: number;
  lidCenterRing: number;
  lidParallel: number;
  handle: number;
}

interface ResolvedSpec {
  diameters: Diameters;
  verticalCount: number;
  verticalMode: "continuous" | "per_curve";
  perCurveCounts: number[];
  ringPlacement: "inside" | "outside";
  bottomPattern: "radial" | "parallel" | "none";
  bottomRadialMode: "center" | "center_ring";
  bottomRadialCount: number;
  bottomCenterDiameter: number;
  bottomParallelLines: number;
  lidPattern: "radial" | "parallel" | "none";
  lidRadialCount: number;
  lidParallelLines: number;
  lidCenterDiameter: number;
  lidRadialMode: "center" | "center_ring";
  lidWallCount: number;
}

// Every FI field falls back to a related one (mirroring normalize_spec's own
// fallback chain), not straight to a hard-coded 4mm — e.g. lid_radial falls
// back to lid_top, which itself falls back to the base "same" FI.
function resolveDiameters(frame: FrameInput): Diameters {
  const same = Math.max(num(frame.sameDiameter, 4), 0.5);
  if (frame.diameterMode !== "custom") {
    return {
      top: same,
      body: same,
      bottomRim: same,
      vertical: same,
      bottomRadial: same,
      bottomCenterRing: same,
      bottomParallel: same,
      lidTop: same,
      lidWall: same,
      lidBottom: same,
      lidRadial: same,
      lidCenterRing: same,
      lidParallel: same,
      handle: same,
    };
  }
  const pick = (v: number | undefined, fallback: number) => Math.max(num(v, fallback), 0.5);
  const top = pick(frame.topDiameter, same);
  const bottomRim = pick(frame.bottomRimDiameter, same);
  const lidTop = pick(frame.lidTopDiameter, top);
  return {
    top,
    body: pick(frame.bodyDiameter, same),
    bottomRim,
    vertical: pick(frame.verticalDiameter, same),
    bottomRadial: pick(frame.bottomRadialDiameter, bottomRim),
    bottomCenterRing: pick(frame.bottomCenterRingDiameter, bottomRim),
    bottomParallel: pick(frame.bottomParallelDiameter, bottomRim),
    lidTop,
    lidWall: pick(frame.lidWallDiameter, pick(frame.verticalDiameter, same)),
    lidBottom: pick(frame.lidBottomDiameter, top),
    lidRadial: pick(frame.lidRadialDiameter, lidTop),
    lidCenterRing: pick(frame.lidCenterRingDiameter, lidTop),
    lidParallel: pick(frame.lidParallelDiameter, lidTop),
    handle: pick(frame.handleDiameter, same),
  };
}

function resolveSpec(frame: FrameInput): ResolvedSpec {
  return {
    diameters: resolveDiameters(frame),
    verticalCount: clamp(frame.verticalCount, 3, 96),
    verticalMode: frame.verticalMode,
    perCurveCounts: frame.perCurveCounts,
    ringPlacement: frame.ringPlacement,
    bottomPattern: frame.bottomPattern,
    bottomRadialMode: frame.bottomRadialMode,
    bottomRadialCount: clamp(frame.bottomRadialCount, 3, 96),
    bottomCenterDiameter: Math.max(num(frame.bottomCenterDiameter, 60), 1),
    bottomParallelLines: clamp(frame.bottomParallelLines, 1, 96),
    lidPattern: frame.lidPattern,
    lidRadialCount: clamp(frame.lidRadialCount, 3, 96),
    lidParallelLines: clamp(frame.lidParallelLines, 1, 96),
    lidCenterDiameter: Math.max(num(frame.lidCenterDiameter, 60), 1),
    lidRadialMode: frame.lidRadialMode,
    lidWallCount: clamp(frame.lidWallCount ?? frame.verticalCount, 3, 96),
  };
}

// Per-segment vertical rib count for "per_curve" mode: uses the entered
// value for that segment, padding with the base verticalCount for any
// segment beyond what's been entered — mirrors normalize_spec's
// per_curve.first(segment_count) + pad-with-`continuous` behaviour.
function verticalCountForSegment(spec: ResolvedSpec, segmentIndex: number): number {
  const entered = spec.perCurveCounts[segmentIndex];
  return clamp(entered ?? spec.verticalCount, 3, 96);
}

// Slices the (radius, z) sample list down to one segment's own Z range —
// used by "per_curve" mode so each segment's ribs follow the SAME curve
// source "continuous" mode does (denseSamples when a shape is locked/
function polarPoint(radius: number, angle: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
}

function circlePoints3(radius: number, z: number, segments = RING_SEGMENTS): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) pts.push(polarPoint(radius, (Math.PI * 2 * i) / segments, z));
  return pts;
}

// Which real structural member a tube represents, for the BOM (bomEngine.ts)
// to group/name/price by — purely descriptive, never read by the 3D/2D
// rendering paths above. `group` is the BOM's "Bộ phận" column ("Thân" body,
// "Đáy" bottom weave, "Nắp" lid, "Quai" handle); `label` is "Chi tiết".
export interface BomPart {
  group: "Thân" | "Đáy" | "Nắp" | "Quai";
  label: string;
}

// Each member keeps its swept mesh (for the 3D view) AND its raw centerline
// (for 2D drawing projections — Front/Top/Iso in the technical-drawing
// sheet) side by side, since a BufferGeometry can't be projected back into
// a simple polyline.
export interface FrameTube {
  geometry: THREE.BufferGeometry;
  points: THREE.Vector3[];
  closed: boolean;
  diameterMm: number;
  part?: BomPart;
}

function pushTube(tubes: FrameTube[], pts: THREE.Vector3[], dia: number, opts?: { closed?: boolean; part?: BomPart }) {
  const geo = buildTubeGeometry(pts, dia, opts);
  if (geo) tubes.push({ geometry: geo, points: pts, closed: !!opts?.closed, diameterMm: dia, part: opts?.part });
}

// A cutout handle removes the part of whichever vertical rib sits at the
// exact centre of each opening (angle 0 / angle π) that falls inside the
// opening's Z band — matching ANASU's build_split_cutout_vertical instead
// of running the rod straight through. `cutRange` is the GLOBAL cutout
// band (computed once from the mouth), never a per-segment value — reusing
// a segment's own local top/bottom here was the bug that cut an unrelated
// second gap lower down the rib in "per segment" (per_curve) mode.
//
// `high` is finite only for a ROUND opening: a rect cutout's own side bars
// (computeCutoutPaths) already reach the mouth, so the rib just truncates at
// `low` with nothing above. A round opening has no side bars — just a
// circular rim — so the rib instead resumes above `high` (the circle's own
// top) and runs up to the mouth, reconnecting through the gap exactly like
// handlePaths.ts's computeRoundCutoutPaths draws it.
function pushVerticalOrSplit(tubes: FrameTube[], pts: THREE.Vector3[], dia: number, cutRange: { low: number; high: number } | null, part?: BomPart) {
  if (cutRange === null) {
    pushTube(tubes, pts, dia, { part });
    return;
  }
  const { low, high } = cutRange;
  const segTop = Math.max(...pts.map((p) => p.z));
  const segBottom = Math.min(...pts.map((p) => p.z));

  if (segBottom < low - 0.001) {
    const lower = pathSliceBetweenZ(pts, segBottom, Math.min(low, segTop));
    if (lower.length >= 2) pushTube(tubes, lower, dia, { part });
  }
  if (Number.isFinite(high) && segTop > high + 0.001) {
    const upper = pathSliceBetweenZ(pts, Math.max(high, segBottom), segTop);
    if (upper.length >= 2) pushTube(tubes, upper, dia, { part });
  }
}

// Every scallop-anchored angle (apex or valley of each petal, every Nth per
// scallop.verticalEvery) — vertical ribs land exactly on these instead of
// the usual even angular spacing, since they need to meet real petal
// features, not arbitrary points around the rim.
function scallopVerticalAngles(geo: ScallopGeometry, scallop: ScallopInput): number[] {
  const every = Math.max(Math.round(scallop.verticalEvery), 1);
  const angles: number[] = [];
  for (let k = 0; k < geo.count; k += every) {
    angles.push(scallop.verticalAnchor === "apex" ? scallopApexAngle(geo, k) : scallopValleyAngle(geo, k));
  }
  return angles;
}

// The mouth sample (samples[0]) already sits at the entered mouth Z, which
// is the petal APEX level — so a vertical anchored at an apex needs no
// adjustment at all: the full mouth-to-base profile applies unchanged.
// One anchored at a valley needs to START lower, at heightMm below that
// (scallopZOffsetAtAngle returns 0 at apexes, -heightMm at valleys) — which
// means DROPPING every original sample between the valley and the mouth
// (they sit inside the carved-away petal notch), not just moving the first
// point down and leaving the rest of the now-obsolete mouth-area samples in
// place. Leaving them in produced a spike: the rib would dip to the valley
// and then jump straight back up to near-mouth height for the next sample.
function scallopVerticalPoints(samples: Sample[], geo: ScallopGeometry, angle: number): THREE.Vector3[] {
  const offset = scallopZOffsetAtAngle(geo, angle);
  if (Math.abs(offset) <= 0.01) {
    return samples.map(([r, z]) => polarPoint(r, angle, z));
  }
  const startZ = samples[0][1] + offset;
  const startPoint = polarPoint(radiusAtZ(samples, startZ), angle, startZ);
  const rest = samples.filter(([, z]) => z < startZ - 0.01).map(([r, z]) => polarPoint(r, angle, z));
  return [startPoint, ...rest];
}

function addVerticals(tubes: FrameTube[], sections: Section[], samples: Sample[], handle: HandleInput, spec: ResolvedSpec, scallop: ScallopInput) {
  const dia = spec.diameters.vertical;
  const cutRange: { low: number; high: number } | null =
    handle.type !== "cutout"
      ? null
      : handle.cutoutShape === "round"
        ? (() => {
            const zTop = sections[0].zMm - Math.max(handle.cutoutOffset, 0);
            const radius = Math.max(handle.cutoutWidth, 10) / 2;
            return { low: zTop - 2 * radius, high: zTop };
          })()
        : { low: sections[0].zMm - Math.max(handle.cutoutOffset, 0) - Math.max(handle.cutoutDepth, 5), high: Infinity };
  const part: BomPart = { group: "Thân", label: "Nan dọc" };

  if (scallop.enabled) {
    const geo = resolveScallopGeometry(scallop, samples);
    for (const angle of scallopVerticalAngles(geo, scallop)) {
      pushTube(tubes, scallopVerticalPoints(samples, geo, angle), dia, { part });
    }
    return;
  }

  if (spec.verticalMode === "per_curve") {
    for (let i = 0; i < sections.length - 1; i++) {
      // Same curve SOURCE "continuous" mode uses below (denseSamples when a
      // shape is locked/traced, the plain ring-to-ring bow otherwise) — just
      // that one segment's own Z slice of it, not a re-derivation via
      // segmentSamples. Locking a shape (Khóa dáng / Đính kèm ảnh / Vẽ tay)
      // used to have NO effect here: this branch called segmentSamples
      // directly, silently ignoring the locked curve and falling back to the
      // raw ring-clamped bow — wrong shape with no indication anything was
      // off, exactly the "ring you don't want as real structure" bug this
      // session already fixed for "continuous" mode.
      const segSamples = sampleSliceBetweenZ(samples, sections[i + 1].zMm, sections[i].zMm);
      const n = verticalCountForSegment(spec, i);
      for (let j = 0; j < n; j++) {
        const angle = (Math.PI * 2 * j) / n;
        const pts = segSamples.map(([r, z]) => polarPoint(r, angle, z));
        pushVerticalOrSplit(tubes, pts, dia, cutoutCentralRib(j, n) ? cutRange : null, part);
      }
    }
    return;
  }

  for (let i = 0; i < spec.verticalCount; i++) {
    const angle = (Math.PI * 2 * i) / spec.verticalCount;
    const pts = samples.map(([r, z]) => polarPoint(r, angle, z));
    pushVerticalOrSplit(tubes, pts, dia, cutoutCentralRib(i, spec.verticalCount) ? cutRange : null, part);
  }
}

// The mouth ring alone follows the scalloped rim instead of a flat circle,
// in one of two real fabrication styles the user asked for explicitly:
// "continuous" bends the whole rim as one piece, so each valley junction
// gets a small fillet (a real bend can't hold a sharp cusp); "separate"
// welds one arch per petal instead, so each valley is a weld joint and
// doesn't need — or get — that fillet.
function addScallopedTopRing(tubes: FrameTube[], samples: Sample[], dia: number, scallop: ScallopInput, part: BomPart) {
  const geo = resolveScallopGeometry(scallop, samples);
  if (scallop.frameStyle === "separate") {
    for (let k = 0; k < geo.count; k++) {
      pushTube(tubes, buildScallopPetalArch(geo, k), dia, { part });
    }
    return;
  }
  pushTube(tubes, buildScallopRingPointsFilleted(geo, scallop.filletMm), dia, { closed: true, part });
}

function addHorizontalRings(tubes: FrameTube[], sections: Section[], samples: Sample[], spec: ResolvedSpec, scallop: ScallopInput) {
  const rodDia = spec.diameters.vertical;
  let middleIndex = 0;
  sections.forEach((section, i) => {
    const isTop = i === 0;
    const isBottom = i === sections.length - 1;
    const dia = isTop ? spec.diameters.top : isBottom ? spec.diameters.bottomRim : spec.diameters.body;
    const label = isTop ? "Đường miệng" : isBottom ? "Đường đáy" : `Đường ngang ${++middleIndex}`;
    const part: BomPart = { group: "Thân", label };
    if (isTop && scallop.enabled) {
      addScallopedTopRing(tubes, samples, dia, scallop, part);
      return;
    }
    let radius: number;
    if (isTop || isBottom) {
      radius = section.radiusMm;
    } else if (spec.ringPlacement === "outside") {
      radius = section.radiusMm + rodDia / 2 + dia / 2;
    } else {
      radius = section.radiusMm - rodDia / 2 - dia / 2;
    }
    if (radius <= 0) return;
    pushTube(tubes, circlePoints3(radius, section.zMm), dia, { closed: true, part });
  });
}

function addRadialOrParallelFace(
  tubes: FrameTube[],
  radius: number,
  z: number,
  pattern: "radial" | "parallel" | "none",
  radialMode: "center" | "center_ring",
  centerDiameter: number,
  radialCount: number,
  parallelLines: number,
  centerRingDia: number,
  radialDia: number,
  parallelDia: number,
  group: BomPart["group"],
  faceLabel: string,
) {
  // Bare rim ring only — the caller (addBottom/addLid) still pushes that
  // ring separately, this just skips the fill pattern entirely.
  if (pattern === "none") return;
  if (pattern === "parallel") {
    const lines = clamp(parallelLines, 1, 96);
    for (let idx = 0; idx < lines; idx++) {
      const y = lines === 1 ? 0 : -radius + (2 * radius * (idx + 1)) / (lines + 1);
      const x = Math.sqrt(Math.max(radius * radius - y * y, 0));
      pushTube(tubes, [new THREE.Vector3(-x, y, z), new THREE.Vector3(x, y, z)], parallelDia, { part: { group, label: faceLabel } });
    }
    return;
  }

  const centerR = radialMode === "center_ring" ? centerDiameter / 2 : 0;
  if (centerR > 0) {
    pushTube(tubes, circlePoints3(centerR, z), centerRingDia, { closed: true, part: { group, label: `Vòng tâm ${faceLabel.toLowerCase()}` } });
  }
  const n = clamp(radialCount, 3, 96);
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    const p1 = polarPoint(centerR, angle, z);
    const p2 = polarPoint(radius, angle, z);
    pushTube(tubes, [p1, p2], radialDia, { part: { group, label: faceLabel } });
  }
}

function addBottom(tubes: FrameTube[], bottom: Section, spec: ResolvedSpec) {
  const d = spec.diameters;
  if (bottom.radiusMm <= d.bottomRim / 2) return;
  addRadialOrParallelFace(
    tubes,
    bottom.radiusMm,
    bottom.zMm,
    spec.bottomPattern,
    spec.bottomRadialMode,
    spec.bottomCenterDiameter,
    spec.bottomRadialCount,
    spec.bottomParallelLines,
    d.bottomCenterRing,
    d.bottomRadial,
    d.bottomParallel,
    "Đáy",
    "Nan đáy",
  );
}

// The frame's lid ribs reuse the SAME lid (mode/diameter/height) chosen for
// the Solid, same as ANASU composes `frame.lid` from the product lid — the
// Steel Frame form only controls the rib pattern (radial/parallel), not
// whether there IS a lid at all.
function addLid(tubes: FrameTube[], top: Section, lid: LidInput, spec: ResolvedSpec) {
  const mode = lid.mode ?? "none";
  if (mode === "none") return;
  const d = spec.diameters;
  const topRadius = Math.max(num(lid.diameter, top.diameterMm), 0.2) / 2;
  const zMouth = top.zMm;
  const height = Math.max(num(lid.height, 60), 0);

  if (mode === "flat") {
    const zFlat = zMouth + height;
    addRadialOrParallelFace(
      tubes,
      topRadius,
      zFlat,
      spec.lidPattern,
      spec.lidRadialMode,
      spec.lidCenterDiameter,
      spec.lidRadialCount,
      spec.lidParallelLines,
      d.lidCenterRing,
      d.lidRadial,
      d.lidParallel,
      "Nắp",
      "Nan nắp",
    );
    pushTube(tubes, circlePoints3(topRadius, zFlat), d.lidTop, { closed: true, part: { group: "Nắp", label: "Viền nắp" } });
    return;
  }

  const zTop = zMouth + height;
  const bottomRadius = Math.max(num(lid.bottomDiameter, topRadius * 2), 0.2) / 2;
  addRadialOrParallelFace(
    tubes,
    topRadius,
    zTop,
    spec.lidPattern,
    spec.lidRadialMode,
    spec.lidCenterDiameter,
    spec.lidRadialCount,
    spec.lidParallelLines,
    d.lidCenterRing,
    d.lidRadial,
    d.lidParallel,
    "Nắp",
    "Nan nắp - mặt trên",
  );
  pushTube(tubes, circlePoints3(bottomRadius, zMouth), d.lidBottom, { closed: true, part: { group: "Nắp", label: "Đường miệng" } });
  pushTube(tubes, circlePoints3(topRadius, zTop), d.lidTop, { closed: true, part: { group: "Nắp", label: "Đường đáy" } });

  const wallCount = spec.lidWallCount;
  for (let i = 0; i < wallCount; i++) {
    const angle = (Math.PI * 2 * i) / wallCount;
    const p1 = polarPoint(bottomRadius, angle, zMouth);
    const p2 = polarPoint(topRadius, angle, zTop);
    pushTube(tubes, [p1, p2], d.lidWall, { part: { group: "Nắp", label: "Nan nắp" } });
  }
}

function addHandle(tubes: FrameTube[], top: Section, samples: Sample[], handle: HandleInput, spec: ResolvedSpec) {
  const paths = computeHandlePaths(top, samples, handle);
  paths.forEach((pts) => {
    pushTube(tubes, pts, spec.diameters.handle, { part: { group: "Quai", label: "Quai" } });
  });
}

export interface SteelFrameResult {
  tubes: FrameTube[];
  colorHex: string;
}

export function buildSteelFrame(
  rings: RingInput[],
  lid: LidInput,
  handle: HandleInput,
  frame: FrameInput,
  scallop: ScallopInput = DEFAULT_SCALLOP,
  // Same dense (radius, z) curve buildRoundSolid takes (see its own comment)
  // — the "vòng ngang" ring positions/diameters still come from `rings`
  // exactly as chosen (those ARE the real welded structural points), only
  // the rib/tube PATH between them follows this instead of the
  // ring-to-ring clamped bow, since a bent rod can genuinely follow the
  // traced curve when one's available, unlike a hand-specified shape.
  denseSamples?: Sample[],
): SteelFrameResult {
  if (!rings || rings.length < 2) {
    throw new Error("Cần ít nhất 2 ring để dựng khung sắt.");
  }
  const sections = normalizeRings(rings);
  validateSections(sections);
  const samples = denseSamples && denseSamples.length >= 2 ? denseSamples : buildProfileSamples(sections);
  const spec = resolveSpec(frame);
  // Scallop and the cutout handle both modify the mouth area — not
  // supported combined yet (see the same note in buildRoundSolid), so
  // scallop wins and the handle's own cutout bars are skipped.
  const effectiveHandle = scallop.enabled && handle.type === "cutout" ? { ...handle, type: "none" as const } : handle;

  const tubes: FrameTube[] = [];
  addVerticals(tubes, sections, samples, effectiveHandle, spec, scallop);
  addHorizontalRings(tubes, sections, samples, spec, scallop);
  addBottom(tubes, sections[sections.length - 1], spec);
  addLid(tubes, sections[0], lid, spec);
  addHandle(tubes, sections[0], samples, effectiveHandle, spec);

  const colorHex = frame.colorPreset === "custom" ? frame.customColor || "#e3d0b0" : (COLOR_HEX[frame.colorPreset] ?? "#e3d0b0");
  return { tubes, colorHex };
}
