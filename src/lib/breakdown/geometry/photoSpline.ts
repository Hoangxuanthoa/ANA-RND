// A smooth reference curve through the (dense, possibly noisy) traced points,
// used two ways: (1) sample diameter at any chosen ring Z, (2) suggest a
// SMALL set of ring Z's at genuine curvature extrema — profileEngine only
// bows a MONOTONIC segment between two rings (see bowedRadius in
// profileEngine.ts), so a bulge/waist has to be its own ring, exactly like a
// human placing rings by hand would do.
export interface DiameterPoint {
  z: number; // mm, measured up from the base (matches RingInput.z)
  diameter: number; // mm
}

function tangentAt(i: number, pts: DiameterPoint[]): number {
  if (pts.length < 2) return 0;
  if (i === 0) return (pts[1].diameter - pts[0].diameter) / Math.max(pts[1].z - pts[0].z, 1e-6);
  const last = pts.length - 1;
  if (i === last) return (pts[last].diameter - pts[last - 1].diameter) / Math.max(pts[last].z - pts[last - 1].z, 1e-6);
  return (pts[i + 1].diameter - pts[i - 1].diameter) / Math.max(pts[i + 1].z - pts[i - 1].z, 1e-6);
}

// buildDiameterSpline interpolates EXACTLY through every point it's given —
// so if the raw traced points are noisy (independent per-row edge detection,
// see photoEdgeDetect.ts — real photos have lighting/texture jitter a
// synthetic test image won't), the spline still wobbles through that noise
// with continuous derivatives instead of hard corners, which is smoother but
// not actually smooth. This averages each point's diameter with its
// neighbours within windowMm of it BEFORE the curve is built, so the spline
// interpolates a denoised signal instead of every individual wobble.
//
// Weighted by a Gaussian (sigma = windowMm/3) instead of a flat box average:
// a box average's hard cutoff barely reduces noise near the edge of its own
// window (each neighbour counts fully or not at all), so meaningful
// remaining wobble can still survive into the final curve — verified
// against a jittery synthetic trace: at matched shape fidelity (~same
// erosion of a real bulge peak), the Gaussian weighting alone (windowMm=30)
// cut the worst resulting rib kink from 8.2° to 6.4° and an aggregate
// waviness score (sum of |2nd derivative| along the profile) from 13.8 to
// 8.7, simply by tapering each neighbour's contribution smoothly with
// distance instead of including/excluding it abruptly. Real-photo testing
// still showed visible residual ripple at that window, so windowMm was
// raised again to 60 (kink 3.4°, waviness 6.2 on the same test curve) — the
// trade-off is more real-shape erosion (a genuine bulge peak measured ~14mm
// shallower on the synthetic test vs ~7.5mm at windowMm=30), so if a
// product's real bulge/waist is noticeably narrower than that window, this
// may need to come back down or become shape-aware instead of a flat
// constant.
//
// (An earlier attempt replaced this whole averaging step with profileEngine's
// OLD ring/bowedRadius curve — fit through the trace's real curvature
// extrema, then densely resampled — hoping its closed-form smoothness would
// beat empirical denoising outright. Verified and rejected: when a segment
// between two sparse real extrema has to span a big diameter swing (exactly
// the common case — mouth to one bulge to base), the curveDepth needed to
// match it pushes the underlying Hermite curve's OWN tangent-driven base
// curve past the segment's endpoint radius, which then gets silently
// clamped flat for a stretch approaching the ring — and the next segment
// starts fresh right after, producing a flat "shelf" then a sharp kink at
// the ring (measured 24.5°, worse than the box average's own 8.2° on the
// same noisy input). A plain weighted average of real data has no such
// clamp to overshoot into, so it can't produce that failure mode.)
//
// Near the mouth/base, a point's window only has neighbours on ONE side (it
// can't reach past z=0 or past the top), so a plain average gets pulled
// toward whatever direction the curve is trending — verified this corrupted
// a real ⌀319mm base point into ⌀326.7mm, a visible kink right where the
// frame ribs meet the base ring. Padding the window with an ODD (trend-
// continuing) reflection of the nearby points around each end fixes this:
// reflecting z anti-symmetrically continues the local slope past the edge
// instead of just copying values back in, so a window straddling the edge
// averages out to the true edge value again instead of being biased by it.
export function smoothDiameters(points: DiameterPoint[], windowMm = 60): DiameterPoint[] {
  const sorted = [...points].sort((a, b) => a.z - b.z);
  if (sorted.length < 2) return sorted;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const sigmaMm = windowMm / 3;

  const padded: DiameterPoint[] = [
    ...sorted
      .filter((p) => p !== first && p.z - first.z <= windowMm)
      .map((p) => ({ z: first.z - (p.z - first.z), diameter: 2 * first.diameter - p.diameter })),
    ...sorted,
    ...sorted
      .filter((p) => p !== last && last.z - p.z <= windowMm)
      .map((p) => ({ z: last.z + (last.z - p.z), diameter: 2 * last.diameter - p.diameter })),
  ];

  return sorted.map((p) => {
    let weightSum = 0;
    let diameterSum = 0;
    for (const q of padded) {
      const dz = q.z - p.z;
      if (Math.abs(dz) > windowMm) continue;
      const weight = Math.exp(-(dz * dz) / (2 * sigmaMm * sigmaMm));
      weightSum += weight;
      diameterSum += weight * q.diameter;
    }
    return { z: p.z, diameter: diameterSum / weightSum };
  });
}

// Non-uniform Catmull-Rom (Hermite with finite-difference tangents): smooth
// and passes through every point even though they aren't evenly spaced in z.
export function buildDiameterSpline(rawPoints: DiameterPoint[]): (z: number) => number {
  const pts = [...rawPoints].sort((a, b) => a.z - b.z);
  if (pts.length === 0) return () => 0;
  if (pts.length === 1) return () => pts[0].diameter;
  const tangents = pts.map((_, i) => tangentAt(i, pts));

  return function sample(z: number): number {
    if (z <= pts[0].z) return pts[0].diameter;
    if (z >= pts[pts.length - 1].z) return pts[pts.length - 1].diameter;
    let i = 0;
    while (i < pts.length - 2 && z > pts[i + 1].z) i++;
    const z0 = pts[i].z;
    const z1 = pts[i + 1].z;
    const d0 = pts[i].diameter;
    const d1 = pts[i + 1].diameter;
    const h = Math.max(z1 - z0, 1e-6);
    const t = (z - z0) / h;
    const m0 = tangents[i] * h;
    const m1 = tangents[i + 1] * h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * d0 + h10 * m0 + h01 * d1 + h11 * m1;
  };
}

// Classic zig-zag turning-point extraction: track the running local
// extremum and only confirm a turn once the signal has moved AWAY from it by
// at least minProminenceMm. An immediate-neighbor check (cur vs prev/next)
// fails on a broad, gradual bulge/waist: right at the true peak the slope is
// ~0, so neighbors are nearly identical to it even though the bulge as a
// whole is very prominent — this tracks cumulative movement instead, so it
// isn't fooled by that.
export function suggestRingZs(points: DiameterPoint[], minSpacingMm = 20, minProminenceMm = 4): number[] {
  const pts = [...points].sort((a, b) => a.z - b.z);
  if (pts.length < 2) return pts.map((p) => p.z);

  const turnIndices: number[] = [0];
  let direction: 1 | -1 | 0 = 0;
  let extremumIdx = 0;

  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].diameter;
    const extremumD = pts[extremumIdx].diameter;
    if (direction === 0) {
      if (d > extremumD) {
        extremumIdx = i;
        direction = 1;
      } else if (d < extremumD) {
        extremumIdx = i;
        direction = -1;
      }
      continue;
    }
    const movedAway = direction === 1 ? extremumD - d : d - extremumD;
    if (movedAway >= minProminenceMm) {
      turnIndices.push(extremumIdx);
      direction = direction === 1 ? -1 : 1;
      extremumIdx = i;
    } else if (direction === 1 ? d > extremumD : d < extremumD) {
      extremumIdx = i;
    }
  }
  turnIndices.push(pts.length - 1);

  const picks: number[] = [pts[turnIndices[0]].z];
  for (let i = 1; i < turnIndices.length - 1; i++) {
    const z = pts[turnIndices[i]].z;
    if (z - picks[picks.length - 1] >= minSpacingMm) picks.push(z);
  }
  const lastZ = pts[turnIndices[turnIndices.length - 1]].z;
  if (lastZ - picks[picks.length - 1] >= minSpacingMm) picks.push(lastZ);
  else picks[picks.length - 1] = lastZ;
  return picks;
}
