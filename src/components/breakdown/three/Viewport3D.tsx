"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface Bounds3D {
  heightMm: number;
  radiusMm: number;
  minZMm: number;
  maxZMm: number;
}

const VIEW_PRESETS = [
  { key: "iso", label: "Iso" },
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
] as const;
type ViewKey = (typeof VIEW_PRESETS)[number]["key"];

const FOV_DEG = 45;
// Extra headroom around the model so a view preset never crops it — derived
// from the vertical half-FOV rather than a flat magic-number multiplier.
const FRAME_MARGIN = 1.3;
const HALF_FOV_RAD = (FOV_DEG / 2) * (Math.PI / 180);

function framingDistance(bounds: Bounds3D): number {
  const halfExtent = Math.max(bounds.radiusMm, bounds.heightMm / 2, 50);
  return (halfExtent / Math.tan(HALF_FOV_RAD)) * FRAME_MARGIN;
}

// Our product geometry is Z-up (matching ANASU/SketchUp); the whole scene is
// rotated -90° about X once (see SolidMesh/FrameMesh) so Three's Y-up camera
// conventions apply here without touching any geometry math.
function directionFor(key: ViewKey): THREE.Vector3 {
  switch (key) {
    case "front":
      return new THREE.Vector3(0, 0, 1);
    case "back":
      return new THREE.Vector3(0, 0, -1);
    case "left":
      return new THREE.Vector3(-1, 0, 0);
    case "right":
      return new THREE.Vector3(1, 0, 0);
    case "top":
      return new THREE.Vector3(0, 1, 0.0001).normalize();
    case "bottom":
      return new THREE.Vector3(0, -1, 0.0001).normalize();
    case "iso":
    default:
      return new THREE.Vector3(1, 0.9, 1).normalize();
  }
}

function isOrthographicCamera(camera: THREE.Camera): camera is THREE.OrthographicCamera {
  return (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
}

type ControlsLike = { target: THREE.Vector3; update: () => void } | null;

// Snaps the CURRENT default camera (whichever of perspective/orthographic is
// mounted) to a requested preset view. Latest bounds/camera/controls/size are
// kept in a ref (synced via a post-render effect, not during render) so the
// snapping effect only fires when the user actually clicks a preset
// (`request` changes) — NOT every time ring params change and `bounds` is
// recomputed, which previously caused the view to "auto-zoom" while typing.
function CameraRig({ bounds, request }: { bounds: Bounds3D; request: { key: ViewKey; nonce: number } | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike;
  const size = useThree((s) => s.size);

  const latestRef = useRef({ bounds, camera, controls, size });
  useEffect(() => {
    latestRef.current = { bounds, camera, controls, size };
  });

  useEffect(() => {
    if (!request) return;
    const { bounds: b, camera: cam, controls: ctrl, size: sz } = latestRef.current;
    const midY = (b.maxZMm + b.minZMm) / 2;
    const distance = framingDistance(b);
    const target = new THREE.Vector3(0, midY, 0);
    const dir = directionFor(request.key);
    cam.position.copy(target.clone().addScaledVector(dir, distance));
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    if (isOrthographicCamera(cam)) {
      const halfExtent = Math.max(b.radiusMm, b.heightMm / 2, 50) * FRAME_MARGIN;
      const minDim = Math.min(sz.width, sz.height);
      cam.zoom = minDim / 2 / halfExtent;
      cam.updateProjectionMatrix();
    }
    if (ctrl) {
      ctrl.target.copy(target);
      ctrl.update();
    }
  }, [request]);

  return null;
}

// Sets the ortho camera's zoom right after mount/toggle, once the canvas has
// a real pixel size to derive it from (drei's default frustum is sized off
// the canvas, `zoom` just scales it).
function InitialOrthoZoom({ enabled, halfExtent }: { enabled: boolean; halfExtent: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const latestRef = useRef({ camera, size });
  useEffect(() => {
    latestRef.current = { camera, size };
  });

  useEffect(() => {
    if (!enabled) return;
    const { camera: cam, size: sz } = latestRef.current;
    if (!isOrthographicCamera(cam)) return;
    const minDim = Math.min(sz.width, sz.height);
    cam.zoom = minDim / 2 / halfExtent;
    cam.updateProjectionMatrix();
    // Only re-derive when ortho mode is (re-)entered or the canvas is
    // resized — not on every ring edit.
  }, [enabled, halfExtent]);

  return null;
}

// Slugifies a view label ("Khung sắt" → "khung-sat") for use as a download
// filename — strips accents rather than leaving them in (a raw Vietnamese
// filename downloads fine on modern OSes, but this reads cleaner and avoids
// any edge case with older tooling the user might drag the file into).
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function Viewport3D({ label, bounds, children }: { label: string; bounds: Bounds3D; children: React.ReactNode }) {
  const [request, setRequest] = useState<{ key: ViewKey; nonce: number } | null>(null);
  const [perspective, setPerspective] = useState(true);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "error">("idle");

  // gl.preserveDrawingBuffer (set on <Canvas> below) keeps the last-rendered
  // frame in the WebGL buffer instead of clearing it right after paint —
  // without it, canvas.toBlob() called from a click handler (i.e. NOT
  // during the render itself) has a good chance of reading back a blank
  // frame, since the buffer may already have been cleared for the next one.
  function captureCanvas(): Promise<Blob | null> {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return Promise.resolve(null);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  async function exportImage() {
    const blob = await captureCanvas();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(label)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyImage() {
    const blob = await captureCanvas();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyStatus("done");
    } catch {
      setCopyStatus("error");
    }
    setTimeout(() => setCopyStatus("idle"), 1500);
  }

  // Initial camera placement (iso), computed once at mount from the bounds
  // available then — never recomputed afterwards, so editing ring params
  // doesn't reset the user's framing.
  const [initial] = useState(() => {
    const initialDistance = framingDistance(bounds);
    const initialMidY = (bounds.maxZMm + bounds.minZMm) / 2;
    return { initialDistance, initialMidY };
  });
  const initialDir = directionFor("iso");
  const initialPos: [number, number, number] = [
    initialDir.x * initial.initialDistance,
    initial.initialMidY + initialDir.y * initial.initialDistance,
    initialDir.z * initial.initialDistance,
  ];
  const initialHalfExtent = Math.max(bounds.radiusMm, bounds.heightMm / 2, 50) * FRAME_MARGIN;

  return (
    <div className="flex h-full flex-col">
      {/* This toolbar lives in a HALF-width 3D view pane (two sit side by
          side), so it stays tight on room. Dropping the KHUNG SẮT/SOLID
          label (the 3D model itself already makes that obvious) and keeping
          export/copy icon-only frees up enough width for the 7 view-angle
          presets to stay one-click buttons instead of a dropdown. */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2 py-1.5">
        <label className="flex flex-shrink-0 items-center gap-1 text-[10px] font-semibold text-text-muted">
          <input
            type="checkbox"
            checked={perspective}
            onChange={(e) => setPerspective(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Phối cảnh
        </label>
        <div className="flex min-w-0 flex-1 flex-wrap gap-0.5">
          {VIEW_PRESETS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setRequest({ key: v.key, nonce: Date.now() })}
              className={
                request?.key === v.key
                  ? "rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white"
                  : "rounded px-1.5 py-0.5 text-[10px] font-semibold text-text-muted hover:bg-bg hover:text-text"
              }
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={exportImage}
            title="Xuất ảnh (PNG) theo góc nhìn hiện tại"
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-muted hover:bg-bg hover:text-text"
          >
            ⬇
          </button>
          <button
            type="button"
            onClick={copyImage}
            title={copyStatus === "done" ? "Đã copy" : copyStatus === "error" ? "Lỗi copy" : "Copy ảnh theo góc nhìn hiện tại"}
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-muted hover:bg-bg hover:text-text"
          >
            {copyStatus === "done" ? "✓" : copyStatus === "error" ? "✕" : "⧉"}
          </button>
        </div>
      </div>
      <div ref={canvasWrapRef} className="min-h-0 flex-1">
        <Canvas gl={{ preserveDrawingBuffer: true }}>
          {perspective ? (
            <PerspectiveCamera makeDefault position={initialPos} fov={FOV_DEG} near={1} far={20000} />
          ) : (
            <OrthographicCamera makeDefault position={initialPos} zoom={1} near={1} far={20000} />
          )}
          <color attach="background" args={["#fafafa"]} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[500, 800, 600]} intensity={1.0} />
          <directionalLight position={[-400, -200, -300]} intensity={0.4} />
          {children}
          {/* SketchUp-style navigation: scroll zooms toward the cursor (not a
              fixed origin), middle-mouse-drag orbits, left/right pan. */}
          <OrbitControls
            makeDefault
            zoomToCursor
            target={[0, initial.initialMidY, 0]}
            mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
          />
          <CameraRig bounds={bounds} request={request} />
          <InitialOrthoZoom enabled={!perspective} halfExtent={initialHalfExtent} />
        </Canvas>
      </div>
    </div>
  );
}
