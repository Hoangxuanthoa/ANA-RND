// Ellipse's handle mounts at the 2 vertices (±a, 0), using ROUND'S OWN
// handle logic verbatim (standing AND cutout) — same approach as
// ovalHandlePaths.ts, just with the correct LOCAL circle for a genuinely
// curved (non-circular) boundary: the region right at a vertex is well
// approximated by its OSCULATING circle — radius ρ = b²/a (the standard
// ellipse radius-of-curvature formula at (±a, 0)), centered NOT at the
// ellipse's own origin but offset inward along the major axis by
// (a − ρ). This is the ellipse analogue of Oval's own cap-center offset
// (hl − r) — same idea, different formula, since an ellipse's "cap" isn't
// a true circle the way a stadium's is. Now follows the body's REAL bowed
// length/width curve (ellipseDimsAtZ), not just a straight mouth→base
// taper, so a ring bulge near the mouth carries through to the handle
// mount too — see ovalHandlePaths.ts's own comment for the same change.
import * as THREE from "three";
import { computeHandlePaths } from "./handlePaths";
import { buildEllipseProfileSamples, ellipseDimsAtZ, normalizeEllipseRings, type EllipseSample } from "./ellipseProfileEngine";
import type { EllipseRingInput, HandleInput, Section } from "./types";

function vertexCurvature(length: number, width: number): { a: number; rho: number } {
  const a = Math.max(length, 0.001) / 2;
  const b = Math.max(width, 0.001) / 2;
  const rho = (b * b) / Math.max(a, 0.0001);
  return { a, rho };
}

export function computeEllipseHandlePaths(rings: EllipseRingInput[], handle: HandleInput): THREE.Vector3[][] {
  if (handle.type === "none" || !rings || rings.length < 2) return [];

  const sections = normalizeEllipseRings(rings);
  const ellipseSamples: EllipseSample[] = buildEllipseProfileSamples(rings);
  const mouth = sections[0];

  const { rho: mouthRho } = vertexCurvature(mouth.lengthMm, mouth.widthMm);
  const top: Section = {
    name: "ellipse-mouth",
    zMm: mouth.zMm,
    radiusMm: mouthRho,
    diameterMm: mouthRho * 2,
    transition: "straight",
    curveDepth: 0,
    curveControls: [],
    tangentAngle: null,
    cap: false,
  };
  // Local curvature radius ρ tracked along the WHOLE dense curve, not just
  // linearly taper between mouth/base — an intermediate bulge changes ρ too.
  const samples: Array<[number, number]> = ellipseSamples.map(([length, width, z]) => [vertexCurvature(length, width).rho, z]);

  const paths = computeHandlePaths(top, samples, handle);
  if (paths.length === 0) return paths;
  // computeStandingPaths/computeCutoutPaths both loop `side` as the OUTER
  // loop and push the SAME fixed count of paths per side — first half of
  // the returned array is always the +X vertex, second half the -X vertex.
  const half = paths.length / 2;
  return paths.map((pts, i) => {
    const sign = i < half ? 1 : -1;
    return pts.map((p) => {
      const { length, width } = ellipseDimsAtZ(ellipseSamples, p.z);
      const { a, rho } = vertexCurvature(length, width);
      return new THREE.Vector3(p.x + sign * (a - rho), p.y, p.z);
    });
  });
}
