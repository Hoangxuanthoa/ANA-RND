// TypeScript port of ANASU's FrameEngine tube-sweep (add_tube_path /
// tube_rings_continuous / tube_ring_from_basis). This is shape-agnostic —
// it just extrudes a circular cross-section along any 3D point path — so
// it is reused unchanged for every steel member (verticals, rings, handles).
import * as THREE from "three";
import { clamp } from "./math";

type Vec3 = [number, number, number];

function normalizeVec(x: number, y: number, z: number): Vec3 | null {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-6) return null;
  return [x / len, y / len, z / len];
}

function direction(a: THREE.Vector3, b: THREE.Vector3): Vec3 {
  return normalizeVec(b.x - a.x, b.y - a.y, b.z - a.z) ?? [0, 0, 1];
}

function rotateVec(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
  const cross: Vec3 = [
    axis[1] * v[2] - axis[2] * v[1],
    axis[2] * v[0] - axis[0] * v[2],
    axis[0] * v[1] - axis[1] * v[0],
  ];
  return [
    v[0] * c + cross[0] * s + axis[0] * d * (1 - c),
    v[1] * c + cross[1] * s + axis[1] * d * (1 - c),
    v[2] * c + cross[2] * s + axis[2] * d * (1 - c),
  ];
}

function tubeRingFromBasis(p: THREE.Vector3, tangent: Vec3, u: Vec3, radius: number, n: number): THREE.Vector3[] {
  const v =
    normalizeVec(
      tangent[1] * u[2] - tangent[2] * u[1],
      tangent[2] * u[0] - tangent[0] * u[2],
      tangent[0] * u[1] - tangent[1] * u[0],
    ) ?? [0, 1, 0];
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const cu = Math.cos(a) * radius;
    const cv = Math.sin(a) * radius;
    ring.push(new THREE.Vector3(p.x + u[0] * cu + v[0] * cv, p.y + u[1] * cu + v[1] * cv, p.z + u[2] * cu + v[2] * cv));
  }
  return ring;
}

// Builds one ring of cross-section points per input point, carrying a
// transported frame along the path (parallel transport, not Frenet) so the
// cross-section doesn't flip or twist on curved/reversing paths.
function tubeRingsContinuous(points: THREE.Vector3[], radius: number, n: number): THREE.Vector3[][] {
  const tangents: Vec3[] = points.map((_, i) => {
    if (i === 0) return direction(points[0], points[1]);
    if (i === points.length - 1) return direction(points[i - 1], points[i]);
    const a = direction(points[i - 1], points[i]);
    const b = direction(points[i], points[i + 1]);
    return normalizeVec(a[0] + b[0], a[1] + b[1], a[2] + b[2]) ?? b;
  });

  const t0 = tangents[0];
  const ref: Vec3 = Math.abs(t0[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u: Vec3 = normalizeVec(
    t0[1] * ref[2] - t0[2] * ref[1],
    t0[2] * ref[0] - t0[0] * ref[2],
    t0[0] * ref[1] - t0[1] * ref[0],
  ) ?? [1, 0, 0];

  const rings: THREE.Vector3[][] = [tubeRingFromBasis(points[0], t0, u, radius, n)];

  for (let i = 1; i < points.length; i++) {
    const prevT = tangents[i - 1];
    const t = tangents[i];
    let axis: Vec3 = [
      prevT[1] * t[2] - prevT[2] * t[1],
      prevT[2] * t[0] - prevT[0] * t[2],
      prevT[0] * t[1] - prevT[1] * t[0],
    ];
    const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
    const dot = clamp(prevT[0] * t[0] + prevT[1] * t[1] + prevT[2] * t[2], -1, 1);
    if (axisLen > 1e-7) {
      axis = [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen];
      const angle = Math.acos(dot);
      u = rotateVec(u, axis, angle);
    } else if (dot < -0.999) {
      const ref2: Vec3 = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      u = normalizeVec(t[1] * ref2[2] - t[2] * ref2[1], t[2] * ref2[0] - t[0] * ref2[2], t[0] * ref2[1] - t[1] * ref2[0]) ?? u;
    }
    // Re-orthogonalize against the new tangent to remove drift.
    const proj = u[0] * t[0] + u[1] * t[1] + u[2] * t[2];
    u = normalizeVec(u[0] - proj * t[0], u[1] - proj * t[1], u[2] - proj * t[2]) ?? u;
    rings.push(tubeRingFromBasis(points[i], t, u, radius, n));
  }
  return rings;
}

export interface TubeOptions {
  closed?: boolean;
  segments?: number; // cross-section segment count, matches ANASU's TUBE_SEGMENTS = 8
}

export function buildTubeGeometry(points: THREE.Vector3[], diameterMm: number, options: TubeOptions = {}): THREE.BufferGeometry | null {
  const n = options.segments ?? 8;
  let pts = points;
  if (options.closed && pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 0.001) {
    pts = pts.slice(0, -1);
  }
  if (pts.length < 2) return null;

  const radius = Math.max(diameterMm / 2, 0.1);
  const rings = tubeRingsContinuous(pts, radius, n);

  // Torus-style unwrap: u runs along the swept path (one seam where it
  // wraps, same caveat as any closed-loop UV — see profileEngine.ts's
  // cylindricalUV), v runs around the small cross-section.
  const positions: number[] = [];
  const uvs: number[] = [];
  rings.forEach((ring, i) => {
    const u = i / (rings.length - 1 || 1);
    ring.forEach((p, j) => {
      positions.push(p.x, p.y, p.z);
      uvs.push(u, j / n);
    });
  });

  const indices: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + k;
      const c = (i + 1) * n + k;
      const d = (i + 1) * n + j;
      indices.push(a, b, c, a, c, d);
    }
  }
  if (options.closed) {
    const last = rings.length - 1;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      indices.push(last * n + j, last * n + k, k, last * n + j, k, j);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
