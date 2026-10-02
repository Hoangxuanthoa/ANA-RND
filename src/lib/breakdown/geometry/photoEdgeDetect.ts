// Semi-automatic silhouette detection for the photo-trace input: no separate
// background-removal step (v1 skips it), instead the background color itself
// is estimated from the image's outer margin band and used as the reference
// each row's left/right scan compares against — this doubles as the "tách
// nền" step without a dedicated masking pass.
export interface DetectedTrace {
  axisXPx: number;
  points: { xPx: number; yPx: number }[];
}

function pixelAt(data: Uint8ClampedArray, w: number, x: number, y: number): readonly [number, number, number] {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

function colorDist(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A soft drop shadow on the table is a common false-positive here: it can
// easily clear a fixed color-distance-from-background threshold (it's a real
// color shift), pulling the detected edge out to the shadow's boundary
// instead of the product's. The fix is a SECOND, independent criterion: a
// real material edge is a sharp jump over a few pixels, while a shadow is a
// gradual fade over many — so a candidate only counts if the color also
// jumps sharply versus a point a few pixels further back along the scan
// (still confirmed background/shadow territory), not just versus the
// original background estimate.
function scanEdge(
  data: Uint8ClampedArray,
  w: number,
  y: number,
  start: number,
  end: number,
  bg: readonly number[],
  threshold: number,
  gradientStep: number,
  gradientThreshold: number,
): number {
  const dir = end >= start ? 1 : -1;
  for (let x = start; dir === 1 ? x <= end : x >= end; x += dir) {
    const c = pixelAt(data, w, x, y);
    if (colorDist(c, bg) <= threshold) continue;
    const backX = dir === 1 ? Math.max(start, x - gradientStep) : Math.min(start, x + gradientStep);
    const backC = pixelAt(data, w, backX, y);
    if (colorDist(c, backC) > gradientThreshold) return x;
  }
  return -1;
}

export function detectSilhouette(
  imageData: ImageData,
  sampleRows = 48,
  threshold = 42,
  gradientStep = 6,
  gradientThreshold = 55,
): DetectedTrace | null {
  const { width: w, height: h, data } = imageData;
  if (w < 4 || h < 4) return null;

  const margin = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const bgSum = [0, 0, 0];
  let bgCount = 0;
  const hStep = Math.max(1, Math.round(w / 120));
  const vStep = Math.max(1, Math.round(h / 120));
  for (let x = 0; x < w; x += hStep) {
    for (const y of [margin, h - 1 - margin]) {
      const c = pixelAt(data, w, x, y);
      bgSum[0] += c[0];
      bgSum[1] += c[1];
      bgSum[2] += c[2];
      bgCount++;
    }
  }
  for (let y = 0; y < h; y += vStep) {
    for (const x of [margin, w - 1 - margin]) {
      const c = pixelAt(data, w, x, y);
      bgSum[0] += c[0];
      bgSum[1] += c[1];
      bgSum[2] += c[2];
      bgCount++;
    }
  }
  if (bgCount === 0) return null;
  const bg = [bgSum[0] / bgCount, bgSum[1] / bgCount, bgSum[2] / bgCount];

  const rows: { y: number; left: number; right: number }[] = [];
  for (let i = 0; i < sampleRows; i++) {
    const y = Math.min(h - 1, Math.round(((i + 0.5) / sampleRows) * h));
    const left = scanEdge(data, w, y, 0, w - 1, bg, threshold, gradientStep, gradientThreshold);
    const right = scanEdge(data, w, y, w - 1, 0, bg, threshold, gradientStep, gradientThreshold);
    if (left >= 0 && right >= 0 && right > left) rows.push({ y, left, right });
  }
  if (rows.length < 2) return null;

  const axisXPx = median(rows.map((r) => (r.left + r.right) / 2));
  const points = rows.map((r) => ({ xPx: axisXPx + (r.right - r.left) / 2, yPx: r.y }));
  return { axisXPx, points };
}
