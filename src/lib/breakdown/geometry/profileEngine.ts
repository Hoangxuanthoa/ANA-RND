// TypeScript port of ANASU's ProfileEngine (src/geometry/profile_engine.rb).
// Ring positions are fixed boundaries; the curve controls only shape the
// radial curve between neighbouring rings. Ported to match the Ruby/SketchUp
// output exactly (same constants, same Hermite interpolation, same bow math).
import * as THREE from "three";
import { clamp, cubicHermite, lerp, num, radiusAtZ, sampleSliceBetweenZ, type Sample } from "./math";
export { radiusAtZ, type Sample } from "./math";
import { DEFAULT_HANDLE, DEFAULT_SCALLOP, type CurveControlPoint, type HandleInput, type LidInput, type RingInput, type ScallopInput, type Section, type Transition } from "./types";
import { buildScallopRingPoints, circlePointsAtAngles, resolveScallopGeometry, scallopRingAngles, scallopSegmentCount } from "./scallopEngine";
import { buildTubeGeometry } from "./tubeSweep";

export const DEFAULT_SEGMENTS = 48;
const STRAIGHT_SAMPLES = 18;
const CURVE_SAMPLES = 32;
const MIN_RADIUS_MM = 0.1;
const EPSILON = 0.001;

function normalizeTransition(value: string | undefined): Transition {
  const text = (value || "").toLowerCase().trim();
  if (text.includes("inward") || text.includes("concave") || text.includes("lõm") || text.includes("lom")) return "inward";
  if (text.includes("outward") || text.includes("convex") || text.includes("lồi") || text.includes("loi")) return "outward";
  return "straight";
}

function normalizeCurveControls(value: CurveControlPoint[] | undefined): CurveControlPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => ({ t: clamp(num(c.t, 0), 0, 1), offset: num(c.offset, 0) }))
    .sort((a, b) => a.t - b.t);
}

export function normalizeRings(rings: RingInput[]): Section[] {
  const sections = rings.map((ring, index) => {
    const diameter = num(ring.diameter, 100);
    return {
      name: (ring.name || `Ring ${index + 1}`).toString(),
      zMm: num(ring.z, 0),
      radiusMm: Math.max(diameter / 2, MIN_RADIUS_MM),
      diameterMm: diameter,
      transition: normalizeTransition(ring.transition),
      curveDepth: clamp(num(ring.curveDepth, 0.34), 0, 0.65),
      curveControls: normalizeCurveControls(ring.curveControls),
      tangentAngle: ring.tangentAngle ?? null,
      cap: !!ring.cap,
    } satisfies Section;
  });
  // Descending Z, same as Ruby's `sort_by { -z_mm }`: sections[0] is the
  // mouth/top ring, sections[last] is the bottom ring.
  return sections.sort((a, b) => b.zMm - a.zMm);
}

export function validateSections(sections: Section[]): void {
  for (let i = 0; i < sections.length - 1; i++) {
    if (Math.abs(sections[i].zMm - sections[i + 1].zMm) < EPSILON) {
      throw new Error("Hai ring không được trùng vị trí Z.");
    }
  }
}

function chordAngle(a: Section, b: Section): number {
  return Math.atan2(b.radiusMm - a.radiusMm, b.zMm - a.zMm);
}

function averageAngles(a: number, b: number): number {
  return Math.atan2(Math.sin(a) + Math.sin(b), Math.cos(a) + Math.cos(b));
}

// A curve meeting a straight segment inherits that straight segment's
// tangent, giving a natural C1 join without an extra fillet bump.
function tangentAngle(sections: Section[], ringIndex: number): number {
  const override = sections[ringIndex]?.tangentAngle;
  if (override !== null && override !== undefined && Number.isFinite(override)) return override;
  if (ringIndex <= 0) return chordAngle(sections[0], sections[1]);
  if (ringIndex >= sections.length - 1) return chordAngle(sections[sections.length - 2], sections[sections.length - 1]);

  const left = chordAngle(sections[ringIndex - 1], sections[ringIndex]);
  const right = chordAngle(sections[ringIndex], sections[ringIndex + 1]);
  const leftType = sections[ringIndex - 1].transition;
  const rightType = sections[ringIndex].transition;
  if (rightType === "straight" && leftType !== "straight") return right;
  if (leftType === "straight" && rightType !== "straight") return left;
  return averageAngles(left, right);
}

function curveControlOffset(controls: CurveControlPoint[], t: number): number {
  if (!controls.length) return 0;
  if (t <= controls[0].t) return controls[0].offset;
  for (let i = 0; i < controls.length - 1; i++) {
    const a = controls[i];
    const b = controls[i + 1];
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(b.t - a.t, 0.0001);
      return lerp(a.offset, b.offset, u);
    }
  }
  return controls[controls.length - 1].offset;
}

function bowedRadius(baseR: number, minR: number, maxR: number, section: Section, type: Transition, t: number): number {
  const direction = type === "outward" ? 1 : -1;
  const available = Math.abs(maxR - minR);
  const bow = Math.sin(Math.PI * t) ** 2;
  const depth = clamp(section.curveDepth, 0, 0.65);
  let radial = baseR + direction * available * depth * 0.7 * bow;
  const limit = direction > 0 ? Math.max(maxR - radial, 0) : Math.max(radial - minR, 0);
  radial += clamp(curveControlOffset(section.curveControls, t), -limit, limit);
  return clamp(radial, minR, maxR);
}

function straightSamples(a: Section, b: Section, index: number, sections: Section[]): Sample[] {
  const startAngle = tangentAngle(sections, index);
  const endAngle = tangentAngle(sections, index + 1);
  const length = Math.max(Math.hypot(b.radiusMm - a.radiusMm, b.zMm - a.zMm), 1);
  const handle = length * 0.2;
  const pts: Sample[] = [];
  for (let sample = 0; sample < STRAIGHT_SAMPLES; sample++) {
    const t = sample / (STRAIGHT_SAMPLES - 1);
    pts.push([
      cubicHermite(a.radiusMm, b.radiusMm, Math.sin(startAngle) * handle, Math.sin(endAngle) * handle, t),
      cubicHermite(a.zMm, b.zMm, Math.cos(startAngle) * handle, Math.cos(endAngle) * handle, t),
    ]);
  }
  return pts;
}

export function segmentSamples(a: Section, b: Section, index: number, sections: Section[]): Sample[] {
  const type = a.transition;
  if (type === "straight") return straightSamples(a, b, index, sections);

  const n = CURVE_SAMPLES;
  const startAngle = tangentAngle(sections, index);
  const endAngle = tangentAngle(sections, index + 1);
  const length = Math.max(Math.hypot(b.radiusMm - a.radiusMm, b.zMm - a.zMm), 1);
  const handle = length * 0.2;
  const minR = Math.min(a.radiusMm, b.radiusMm);
  const maxR = Math.max(a.radiusMm, b.radiusMm);

  const pts: Sample[] = [];
  for (let sample = 0; sample < n; sample++) {
    const t = sample / (n - 1);
    const baseR = cubicHermite(a.radiusMm, b.radiusMm, Math.sin(startAngle) * handle, Math.sin(endAngle) * handle, t);
    const z = cubicHermite(a.zMm, b.zMm, Math.cos(startAngle) * handle, Math.cos(endAngle) * handle, t);
    const radius = bowedRadius(baseR, minR, maxR, a, type, t);
    pts.push([radius, z]);
  }
  pts[0] = [a.radiusMm, a.zMm];
  pts[n - 1] = [b.radiusMm, b.zMm];
  return pts;
}

export function buildProfileSamples(sections: Section[]): Sample[] {
  const result: Sample[] = [];
  for (let index = 0; index < sections.length - 1; index++) {
    const points = segmentSamples(sections[index], sections[index + 1], index, sections);
    const slice = result.length ? points.slice(1) : points;
    result.push(...slice);
  }
  return result;
}

export function circlePoints(radiusMm: number, zMm: number, segments = DEFAULT_SEGMENTS): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (Math.PI * 2 * i) / segments;
    pts.push([radiusMm * Math.cos(angle), radiusMm * Math.sin(angle), zMm]);
  }
  return pts;
}

// Standard cylindrical unwrap for any revolve surface: u wraps once around
// the circumference (there's always one seam where a tiled texture doesn't
// quite meet itself — normal for any revolve, same as a cylinder in any 3D
// tool), v runs 0..1 over the model's real height so a texture's vertical
// scale tracks actual mm rather than sample-row index (which isn't evenly
// spaced — segments near a tight curve get more rows than a straight run).
function cylindricalUV(x: number, y: number, z: number, minZ: number, zSpan: number): [number, number] {
  return [(Math.atan2(y, x) / (Math.PI * 2) + 1) % 1, (z - minZ) / zSpan];
}

function zRange(samples: Sample[]): { minZ: number; zSpan: number } {
  const zs = samples.map(([, z]) => z);
  const minZ = Math.min(...zs);
  const zSpan = Math.max(Math.max(...zs) - minZ, MIN_RADIUS_MM);
  return { minZ, zSpan };
}

export function buildBodyGeometry(samples: Sample[], segments = DEFAULT_SEGMENTS): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const { minZ, zSpan } = zRange(samples);
  samples.forEach(([r, z]) => {
    circlePoints(r, z, segments).forEach(([x, y, zz]) => {
      positions.push(x, y, zz);
      uvs.push(...cylindricalUV(x, y, zz, minZ, zSpan));
    });
  });

  const indices: number[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + k;
      const c = (i + 1) * segments + k;
      const d = (i + 1) * segments + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Same as buildBodyGeometry, but the mouth row (samples[0]) follows a
// scalloped ("cánh hoa") rim instead of a flat circle — every other row
// stays a plain circle. Both use the SAME segment count (the scallop ring's
// own point count) so the existing per-J quad indexing lofts between them
// correctly with no extra logic: buildBodyGeometry never assumed a row's Z
// was constant, only that consecutive rows share the same point count.
function buildBodyGeometryScalloped(samples: Sample[], scallop: ScallopInput, segments: number): THREE.BufferGeometry {
  const geo = resolveScallopGeometry(scallop, samples);
  // Every row must share the scalloped mouth ring's exact (non-uniform)
  // angle list, not circlePoints' evenly-spaced one — otherwise index j in
  // one row lands at a different angle than index j in the next, twisting
  // the quads between them (see scallopRingAngles).
  const angles = scallopRingAngles(geo);
  const positions: number[] = [];
  const uvs: number[] = [];
  const { minZ, zSpan } = zRange(samples);
  samples.forEach(([r, z], i) => {
    const row = i === 0 ? buildScallopRingPoints(geo) : circlePointsAtAngles(r, z, angles);
    row.forEach((p) => {
      positions.push(p.x, p.y, p.z);
      uvs.push(...cylindricalUV(p.x, p.y, p.z, minZ, zSpan));
    });
  });

  const indices: number[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + k;
      const c = (i + 1) * segments + k;
      const d = (i + 1) * segments + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Flat cap (mouth/base cover, lid top): a planar radial unwrap reads far
// better than a cylindrical one here — cylindrical would bunch every ring
// down to a single point at the disc's centre and stretch wildly near it.
export function buildCapGeometry(radiusMm: number, zMm: number, segments = DEFAULT_SEGMENTS): THREE.BufferGeometry {
  const rim = circlePoints(radiusMm, zMm, segments);
  const positions: number[] = [];
  const uvs: number[] = [];
  rim.forEach(([x, y, z], i) => {
    positions.push(x, y, z);
    const angle = (Math.PI * 2 * i) / segments;
    uvs.push(0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle));
  });
  positions.push(0, 0, zMm); // centre vertex
  uvs.push(0.5, 0.5);
  const centerIndex = segments;

  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    indices.push(centerIndex, i, j);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface LidGeometry {
  skirt?: THREE.BufferGeometry;
  top?: THREE.BufferGeometry;
}

// Shared shape ProductScene actually reads — Round's own RoundSolidResult
// (below) carries extra shape-specific fields (sections, for the 2D drawing
// engine) on top of this; other shapes' solid results just need to satisfy
// this minimum to reuse the same 3D viewer with no changes there.
export interface SolidLike {
  body: THREE.BufferGeometry;
  bottomCap?: THREE.BufferGeometry;
  lid: LidGeometry;
  // Only Round sets this (see buildRoundSolid) — exposed so ProductScene's
  // per-band re-loft (buildMaterialBands) can stay scallop-aware too,
  // instead of only the un-split `body` above reflecting the scalloped rim.
  scallop?: ScallopInput;
}

// Lid modes match ANASU: none (no top), flat (one independent top face),
// cover (skirt rising from the mouth + an independent top face). Flat is
// raised by the lid height (same as the Steel Frame's flat lid) instead of
// sitting flush on the mouth — flush against the rim reads as "no lid" at a
// glance.
export function buildLidGeometry(topSection: Section, lid: LidInput): LidGeometry {
  const mode = lid.mode || "none";
  if (mode === "none") return {};

  const diameter = Math.max(num(lid.diameter, topSection.diameterMm), MIN_RADIUS_MM * 2);
  const topZ = topSection.zMm;
  const height = Math.max(num(lid.height, 60), 0);

  if (mode === "flat") {
    return { top: buildCapGeometry(diameter / 2, topZ + height) };
  }

  const bottomDiameter = Math.max(num(lid.bottomDiameter, diameter), MIN_RADIUS_MM * 2);
  const lower = circlePoints(bottomDiameter / 2, topZ);
  const upper = circlePoints(diameter / 2, topZ + height);

  const positions: number[] = [];
  const uvs: number[] = [];
  const { minZ: skirtMinZ, zSpan: skirtZSpan } = zRange([
    [bottomDiameter / 2, topZ],
    [diameter / 2, topZ + height],
  ]);
  lower.forEach(([x, y, z]) => {
    positions.push(x, y, z);
    uvs.push(...cylindricalUV(x, y, z, skirtMinZ, skirtZSpan));
  });
  upper.forEach(([x, y, z]) => {
    positions.push(x, y, z);
    uvs.push(...cylindricalUV(x, y, z, skirtMinZ, skirtZSpan));
  });

  const indices: number[] = [];
  const seg = DEFAULT_SEGMENTS;
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    indices.push(i, j, seg + j, i, seg + j, seg + i);
  }

  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  skirt.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  skirt.setIndex(indices);
  skirt.computeVertexNormals();

  const top = buildCapGeometry(diameter / 2, topZ + height);
  return { skirt, top };
}

// Cutout handle: the body skin gets a real opening (not just steel bars
// around it), because it removes material and affects surface area —
// port of ProfileEngine's build_body_with_cutout / cutout_surface_intervals.
// Exact Z rows are forced at the cutout's top/bottom boundaries so the
// "in the opening" band is split off cleanly from the normal full-ring bands.
function cutoutSurfaceIntervals(radius: number, z: number, width: number, segments: number): [number, number, number][][] {
  const r = Math.max(radius, MIN_RADIUS_MM);
  const halfAngle = Math.asin(clamp(width / 2 / r, 0, 0.999));
  const side = (start: number): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const a = start + (Math.PI - 2 * halfAngle) * (i / segments);
      pts.push([r * Math.cos(a), r * Math.sin(a), z]);
    }
    return pts;
  };
  return [side(halfAngle), side(Math.PI + halfAngle)];
}

function buildBodyGeometryWithCutout(samples: Sample[], handle: HandleInput, segments = DEFAULT_SEGMENTS): THREE.BufferGeometry {
  const mouthZ = samples[0][1];
  const offset = Math.max(handle.cutoutOffset, 0);
  const isRound = handle.cutoutShape === "round";
  // `cutoutWidth` doubles as the opening's diameter when round — a circle
  // has no separate depth, so the band is forced to span exactly one
  // diameter instead of reading the (irrelevant, possibly stale)
  // cutoutDepth field.
  const width = Math.max(handle.cutoutWidth, 10);
  const depth = isRound ? width : Math.max(handle.cutoutDepth, 5);

  const zs = samples.map((s) => s[1]);
  const maxZ = Math.max(...zs);
  const minZ = Math.min(...zs);
  const zTop = Math.min(mouthZ - offset, maxZ);
  const zBottom = Math.max(zTop - depth, minZ);
  // Round: the opening's width at a given Z isn't constant like the rect
  // cutout's — it tapers to a point at zTop/zBottom and is widest exactly
  // at the circle's own mid-height, per the circle equation. This is the
  // ONLY change needed to turn the rect cutout's banded loft into a true
  // circular hole: cutoutSurfaceIntervals already just takes a width per
  // row, so feeding it this instead of the constant `width` does the rest.
  const zCenter = (zTop + zBottom) / 2;
  const halfSpan = (zTop - zBottom) / 2;
  function widthAtZ(z: number): number {
    if (!isRound) return width;
    const d = z - zCenter;
    return 2 * Math.sqrt(Math.max(halfSpan * halfSpan - d * d, 0));
  }

  const zValues = [...zs, zTop, zBottom].sort((a, b) => b - a);
  const uniqueZ: number[] = [];
  for (const z of zValues) {
    if (uniqueZ.length === 0 || Math.abs(uniqueZ[uniqueZ.length - 1] - z) > EPSILON) uniqueZ.push(z);
  }
  const rows: Sample[] = uniqueZ.map((z) => [radiusAtZ(samples, z), z]);

  const positions: number[] = [];
  const uvs: number[] = [];
  const zSpan = Math.max(maxZ - minZ, MIN_RADIUS_MM);
  const indices: number[] = [];
  let cursor = 0;
  // The cutout band's quads aren't a clean row/col grid (see below), so UV
  // is computed per-vertex from its own position rather than a loop index —
  // the same cylindricalUV formula still applies, it just needs (x,y,z)
  // instead of a (row, segment) pair.
  function pushQuad(p00: [number, number, number], p01: [number, number, number], p11: [number, number, number], p10: [number, number, number]) {
    const base = cursor;
    positions.push(...p00, ...p01, ...p11, ...p10);
    [p00, p01, p11, p10].forEach(([x, y, z]) => uvs.push(...cylindricalUV(x, y, z, minZ, zSpan)));
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    cursor += 4;
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const [ra, za] = rows[i];
    const [rb, zb] = rows[i + 1];
    const zMid = (za + zb) / 2;
    const inBand = zMid < zTop - EPSILON && zMid > zBottom + EPSILON;

    if (inBand) {
      const intervalsA = cutoutSurfaceIntervals(ra, za, widthAtZ(za), 24);
      const intervalsB = cutoutSurfaceIntervals(rb, zb, widthAtZ(zb), 24);
      intervalsA.forEach((ia, idx) => {
        const ib = intervalsB[idx];
        const n = Math.min(ia.length, ib.length);
        for (let k = 0; k < n - 1; k++) pushQuad(ia[k], ia[k + 1], ib[k + 1], ib[k]);
      });
      continue;
    }

    const aa = circlePoints(ra, za, segments);
    const bb = circlePoints(rb, zb, segments);
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      pushQuad(aa[j], aa[k], bb[k], bb[j]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface RoundSolidResult extends SolidLike {
  sections: Section[];
  // The resolved dense (radius, z) profile actually used for the body loft
  // (denseSamples when locked/traced, else buildProfileSamples(sections)) —
  // exposed so callers (material-band splitting, ring-tube placement) can
  // slice the SAME curve the body was built from, instead of re-deriving
  // and risking it drift out of sync with what's actually on screen.
  samples: Sample[];
}

export function buildRoundSolid(
  rings: RingInput[],
  lid: LidInput = { mode: "none" },
  handle: HandleInput = DEFAULT_HANDLE,
  scallop: ScallopInput = DEFAULT_SCALLOP,
  // Optional dense (radius, z) profile to loft the BODY from instead of the
  // rings' own segmentSamples — bowedRadius() clamps a segment's radius to
  // within its own two ring endpoints (by design: each ring-to-ring span is
  // a real structural piece in the steel frame, e.g. rigid steel between two
  // welded bands), so a bulge that exceeds BOTH its neighbouring rings'
  // diameters is literally unreachable there no matter the curveDepth. A
  // photo-traced curve has no such constraint — the woven/flexible surface
  // it represents can bulge past a rigid ring — so photo-derived products
  // pass their full traced curve here to render the true silhouette, while
  // `rings` (sparse, whatever the user chose) still independently drives the
  // steel frame — the cap/lid geometry below, which only needs the mouth and
  // base sections, is identical either way.
  denseSamples?: Sample[],
): RoundSolidResult {
  if (!rings || rings.length < 2) {
    throw new Error("Cần ít nhất 2 ring để dựng hình.");
  }
  const sections = normalizeRings(rings);
  validateSections(sections);
  const samples = denseSamples && denseSamples.length >= 2 ? denseSamples : buildProfileSamples(sections);
  // Scallop takes priority over the cutout handle's own body opening when
  // both happen to be set — combining the two isn't supported yet, and the
  // UI should keep them mutually exclusive.
  const body = scallop.enabled
    ? buildBodyGeometryScalloped(samples, scallop, scallopSegmentCount(resolveScallopGeometry(scallop, samples)))
    : handle.type === "cutout"
      ? buildBodyGeometryWithCutout(samples, handle)
      : buildBodyGeometry(samples);
  const bottomSection = sections[sections.length - 1];
  const bottomCap = bottomSection.cap ? buildCapGeometry(bottomSection.radiusMm, bottomSection.zMm) : undefined;
  const lidGeometry = buildLidGeometry(sections[0], lid);
  return { body, bottomCap, lid: lidGeometry, sections, samples, scallop };
}

// Splits the body into `splits.length + 1` independently-UV'd bands, each
// re-lofted from its own Z sub-range of `samples` via buildBodyGeometry —
// so each band's texture tiles at its OWN real height (see cylindricalUV's
// zRange), which is exactly what fixes the "tỷ lệ lệch nhau" a band would
// otherwise get from sharing one whole-body v-range. `splits` are DELIBERATELY
// independent of `rings`/the steel frame — see MaterialInput's own comment.
// Bottom-to-top order (bands[0] is the lowest band) — matches
// MaterialInput.bands' own convention (splits sorted ascending).
// `scallop` — bug fix: this used to ALWAYS re-loft every band via the
// plain buildBodyGeometry, discarding buildRoundSolid's own already-correct
// scalloped `result.body` the moment ANY samples were available (which is
// always, for Round) — ProductScene.tsx calls this whenever `samples` is
// passed, i.e. on every Round product, scalloped or not. The band
// containing the actual mouth row (the one reaching all the way up to
// `top`) now re-lofts through buildBodyGeometryScalloped instead, same as
// buildRoundSolid's own un-split body does; every other band is untouched
// (a scalloped rim only ever affects the TOP row of the whole profile).
export function buildMaterialBands(samples: Sample[], splits: number[], segments = DEFAULT_SEGMENTS, scallop: ScallopInput = DEFAULT_SCALLOP): THREE.BufferGeometry[] {
  const zs = samples.map(([, z]) => z);
  const top = Math.max(...zs);
  const bottom = Math.min(...zs);
  const bounds = [bottom, ...[...splits].sort((a, b) => a - b).filter((z) => z > bottom && z < top), top];
  const bands: THREE.BufferGeometry[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const slice = sampleSliceBetweenZ(samples, bounds[i], bounds[i + 1]);
    const isTopBand = bounds[i + 1] === top;
    bands.push(
      scallop.enabled && isTopBand
        ? buildBodyGeometryScalloped(slice, scallop, scallopSegmentCount(resolveScallopGeometry(scallop, samples)))
        : buildBodyGeometry(slice, segments),
    );
  }
  return bands;
}

// "Ống đường ngang": a rolled-tube ring at an arbitrary Z on the body's own
// surface (radiusAtZ), reusing the exact same tube-sweep as the steel
// frame's mouth/base rim tubes (tubeSweep.ts) — Solid-only decoration, not
// a structural member.
export function buildRingTubeGeometry(samples: Sample[], zMm: number, diameterMm: number, segments = DEFAULT_SEGMENTS): THREE.BufferGeometry | null {
  const radius = radiusAtZ(samples, zMm);
  const path = circlePoints(radius, zMm, segments).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return buildTubeGeometry(path, diameterMm, { closed: true });
}
