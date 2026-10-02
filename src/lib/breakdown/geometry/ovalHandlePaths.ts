// Oval's handle mounts at the 2 cap tips, using ROUND'S OWN handle logic
// verbatim (standing AND cutout) — not a re-derivation. The region right at
// each tip genuinely IS a local circle: radius = width/2, but centered at
// (±(length/2 - width/2), 0), NOT at the oval's own origin the way a round
// mouth's radius is. So this builds a tiny synthetic "Section" describing
// JUST that local circle's radius-by-Z profile — now following the body's
// REAL bowed width curve (ovalDimsAtZ), not just a straight mouth→base
// taper, so a ring bulge near the mouth carries through to the handle mount
// too — and hands it straight to handlePaths.ts's computeHandlePaths, the
// SAME function Round's own solid/frame use, then shifts the result
// sideways by that cap's own center offset from the origin (also Z-aware,
// via the same dense samples).
import * as THREE from "three";
import { computeHandlePaths } from "./handlePaths";
import { buildOvalProfileSamples, normalizeOvalRings, ovalDimsAtZ, type OvalSample } from "./ovalProfileEngine";
import type { Sample } from "./math";
import type { HandleInput, OvalRingInput, Section } from "./types";

export function computeOvalHandlePaths(rings: OvalRingInput[], handle: HandleInput): THREE.Vector3[][] {
  if (handle.type === "none" || !rings || rings.length < 2) return [];

  const sections = normalizeOvalRings(rings);
  const ovalSamples: OvalSample[] = buildOvalProfileSamples(rings);
  const mouth = sections[0];

  const top: Section = {
    name: "oval-mouth",
    zMm: mouth.zMm,
    radiusMm: mouth.widthMm / 2,
    diameterMm: mouth.widthMm,
    transition: "straight",
    curveDepth: 0,
    curveControls: [],
    tangentAngle: null,
    cap: false,
  };
  const samples: Sample[] = ovalSamples.map(([, width, z]) => [width / 2, z]);

  const paths = computeHandlePaths(top, samples, handle);
  if (paths.length === 0) return paths;
  // computeStandingPaths/computeCutoutPaths both loop `side` as the OUTER
  // loop and push the SAME fixed count of paths per side (lines per side
  // for standing, always 4 bars per side for cutout) — so the first half
  // of the returned array is always side 0 (+X tip) and the second half is
  // side 1 (-X tip), regardless of handle type/settings.
  const half = paths.length / 2;
  return paths.map((pts, i) => {
    const sign = i < half ? 1 : -1;
    return pts.map((p) => {
      const { length, width } = ovalDimsAtZ(ovalSamples, p.z);
      return new THREE.Vector3(p.x + sign * (length / 2 - width / 2), p.y, p.z);
    });
  });
}
