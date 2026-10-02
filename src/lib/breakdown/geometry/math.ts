export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Same Hermite basis used by ANASU's ProfileEngine (Ruby) so ring-to-ring
// interpolation matches the SketchUp plugin's output exactly.
export function cubicHermite(p0: number, p1: number, d0: number, d1: number, t: number): number {
  return (
    (2 * t ** 3 - 3 * t ** 2 + 1) * p0 +
    (t ** 3 - 2 * t ** 2 + t) * d0 +
    (-2 * t ** 3 + 3 * t ** 2) * p1 +
    (t ** 3 - t ** 2) * d1
  );
}

export function num(value: number | undefined | null, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  return Number.isFinite(value) ? value : fallback;
}

export type Sample = [radiusMm: number, zMm: number];

const RADIUS_AT_Z_EPSILON = 0.001;

// Body radius at an arbitrary Z, interpolated along the profile curve
// between rings — samples run mouth-to-bottom (descending Z). Used for a
// cutout handle's surface-following sides, and for a scallop petal's
// valley/side points to land on the real (non-flat) body surface instead of
// a constant radius.
export function radiusAtZ(samples: Sample[], z: number): number {
  if (!samples.length) return 0;
  if (z >= samples[0][1]) return samples[0][0];
  if (z <= samples[samples.length - 1][1]) return samples[samples.length - 1][0];
  for (let i = 0; i < samples.length - 1; i++) {
    const [pr, pz] = samples[i];
    const [qr, qz] = samples[i + 1];
    if (z <= pz + RADIUS_AT_Z_EPSILON && z >= qz - RADIUS_AT_Z_EPSILON) {
      const dz = qz - pz;
      const t = clamp(Math.abs(dz) < RADIUS_AT_Z_EPSILON ? 0 : (z - pz) / dz, 0, 1);
      return pr + (qr - pr) * t;
    }
  }
  return samples[samples.length - 1][0];
}

// Z-slices `samples` down to just the [zLow, zHigh] band, pinning both
// endpoints via radiusAtZ (interpolated) rather than whatever the dense
// grid's nearest points happen to be, so a slice's edges land exactly on
// zLow/zHigh instead of wherever the nearest existing sample row sits.
// Shared by frameEngine's per_curve vertical ribs and profileEngine's
// material-band body splitting — both need an arbitrary Z sub-range of the
// same dense profile, independent of where `rings` happen to fall.
export function sampleSliceBetweenZ(samples: Sample[], zLow: number, zHigh: number): Sample[] {
  const inside = samples.filter(([, z]) => z <= zHigh && z >= zLow);
  const result: Sample[] = [];
  if (inside.length === 0 || inside[0][1] < zHigh) result.push([radiusAtZ(samples, zHigh), zHigh]);
  result.push(...inside);
  if (inside.length === 0 || inside[inside.length - 1][1] > zLow) result.push([radiusAtZ(samples, zLow), zLow]);
  return result;
}
