"use client";

import type { SteelFrameResult } from "@/lib/breakdown/geometry/frameEngine";
import { Viewport3D, type Bounds3D } from "./Viewport3D";

// Purely a 3D-preview visualization aid, requested so a "nắp trùm" (cover
// lid) reads clearly as its own separate piece instead of looking like it's
// sitting right on the body — does NOT touch lid.height (the real spec
// value BOM/drawing-export/the solid's own geometry all still use), only
// how high its tubes are DRAWN here. Z is still "up" at this point (same
// convention the geometry engines use — the whole group's own rotation
// below is what converts that to Three.js's Y-up only once, for everything
// inside it at once).
const LID_LIFT_MM = 30;

function FrameMesh({ result, liftLid }: { result: SteelFrameResult; liftLid: boolean }) {
  const lidTubes = liftLid ? result.tubes.filter((t) => t.part?.group === "Nắp") : [];
  const otherTubes = liftLid ? result.tubes.filter((t) => t.part?.group !== "Nắp") : result.tubes;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {otherTubes.map((tube, i) => (
        <mesh key={i} geometry={tube.geometry}>
          <meshStandardMaterial color={result.colorHex} metalness={0.35} roughness={0.5} />
        </mesh>
      ))}
      {lidTubes.length > 0 && (
        <group position={[0, 0, LID_LIFT_MM]}>
          {lidTubes.map((tube, i) => (
            <mesh key={i} geometry={tube.geometry}>
              <meshStandardMaterial color={result.colorHex} metalness={0.35} roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export default function FrameScene({ result, bounds, liftLid = false }: { result: SteelFrameResult; bounds: Bounds3D; liftLid?: boolean }) {
  return (
    <Viewport3D label="Khung sắt" bounds={bounds}>
      <FrameMesh result={result} liftLid={liftLid} />
    </Viewport3D>
  );
}
