"use client";

import { Line } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { buildMaterialBands, buildRingTubeGeometry, type Sample, type SolidLike } from "@/lib/breakdown/geometry/profileEngine";
import type { MaterialBand, MaterialInput, MaterialZoneSettings } from "@/lib/breakdown/geometry/types";
import { Viewport3D, type Bounds3D } from "./Viewport3D";

// Decodes an image URL into an HTMLImageElement — used per-zone (each zone
// may have its own image override, falling back to the shared/default
// upload), so this is called once per ZoneMesh instance, not hoisted to a
// single shared loader.
function useLoadedImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.onload = () => {
      setImage(img);
      setLoadedUrl(url);
    };
    img.src = url;
  }, [url]);

  return loadedUrl === url ? image : null;
}

// wrapS uses MirroredRepeatWrapping (not plain RepeatWrapping): a closed
// revolve/loop is cut-and-unwrapped from a flat photo, so there's always
// ONE seam where the two edges of a non-seamless image meet — mirroring
// makes each repeat tile match its neighbour's edge instead of jump-cutting
// into a fresh copy, which reads as natural variation rather than a hard
// line for most organic material photos. It doesn't fully erase the seam
// (only a source image designed to tile seamlessly can do that), just
// makes it far less jarring.
function makeZoneTexture(image: HTMLImageElement, zone: MaterialZoneSettings): THREE.Texture {
  const texture = new THREE.Texture(image);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.center.set(0.5, 0.5);
  texture.rotation = (zone.rotationDeg * Math.PI) / 180;
  texture.repeat.set(zone.flipX ? -zone.repeatX : zone.repeatX, zone.flipY ? -zone.repeatY : zone.repeatY);
  texture.offset.set(zone.offsetX, zone.offsetY);
  return texture;
}

function useZoneTexture(image: HTMLImageElement | null, enabled: boolean, zone: MaterialZoneSettings): THREE.Texture | null {
  return useMemo(() => {
    if (!enabled || !image) return null;
    return makeZoneTexture(image, zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, enabled, zone.rotationDeg, zone.flipX, zone.flipY, zone.repeatX, zone.repeatY, zone.offsetX, zone.offsetY]);
}

// A flat-color fallback for any geometry that doesn't carry UVs yet (Rect/
// Square solids — see profileEngine.ts's cylindricalUV, not ported there
// yet) so picking a texture never renders those as a broken black surface.
function hasUV(geometry: THREE.BufferGeometry): boolean {
  return !!geometry.getAttribute("uv");
}

// Textured surfaces render unlit (no directional-light shading): the point
// is to show the material itself clearly, like a catalog swatch, not an
// artistically-lit render — MeshStandardMaterial's normal-based shading was
// darkening one side of the body, read as an unwanted "shadow". Flat-color
// (no texture picked yet) surfaces keep the lit look, since that's still
// the plain 3D preview. alphaTest lets a PNG's transparent areas (a loose/
// open weave) show through to whatever's geometrically behind them, instead
// of rendering as opaque.
function SurfaceMaterial({ geometry, color, texture }: { geometry: THREE.BufferGeometry; color: string; texture: THREE.Texture | null }) {
  const map = texture && hasUV(geometry) ? texture : null;
  if (map) {
    return <meshBasicMaterial key={map.uuid} map={map} alphaTest={0.5} side={THREE.DoubleSide} />;
  }
  return <meshStandardMaterial color={color} side={THREE.DoubleSide} />;
}

// One paintable zone's mesh: resolves its own image (own override, else the
// shared/default upload) and builds its own texture — each instance calls
// its own hooks, which is what lets the NUMBER of body bands vary (add/
// remove a split) without ever violating the rules of hooks, unlike a
// single parent component calling one texture-hook per band in a loop.
function ZoneMesh({
  geometry,
  band,
  sharedImageUrl,
  enabled,
  color,
}: {
  geometry: THREE.BufferGeometry;
  band: MaterialBand;
  sharedImageUrl: string | null;
  enabled: boolean;
  color: string;
}) {
  const image = useLoadedImage(band.imageDataUrl ?? sharedImageUrl);
  const texture = useZoneTexture(image, enabled, band.settings);
  return (
    <mesh geometry={geometry}>
      <SurfaceMaterial geometry={geometry} color={color} texture={texture} />
    </mesh>
  );
}

function RingTubes({ samples, material }: { samples: Sample[]; material: MaterialInput }) {
  const tubes = useMemo(() => {
    if (!material.ringTube.enabled) return [];
    return material.splits
      .map((zMm) => buildRingTubeGeometry(samples, zMm, material.ringTube.diameterMm))
      .filter((g): g is THREE.BufferGeometry => !!g);
  }, [samples, material.ringTube.enabled, material.ringTube.diameterMm, material.splits]);

  return (
    <>
      {tubes.map((geometry, i) => (
        <ZoneMesh key={i} geometry={geometry} band={material.ringTube} sharedImageUrl={material.imageDataUrl} enabled={material.enabled} color="#8a6d3b" />
      ))}
    </>
  );
}

// Same 3D-preview-only visual lift as FrameScene.tsx's own LID_LIFT_MM — see
// its comment for why this never touches lid.height itself.
const LID_LIFT_MM = 30;

function SolidMesh({
  result,
  samples,
  handlePaths,
  material,
  liftLid,
}: {
  result: SolidLike;
  samples: Sample[] | undefined;
  handlePaths: THREE.Vector3[][];
  material: MaterialInput;
  liftLid: boolean;
}) {
  const bodyBands = useMemo(() => {
    if (!samples) return [result.body];
    return buildMaterialBands(samples, material.splits, undefined, result.scallop);
  }, [samples, material.splits, result.body, result.scallop]);

  const lidGroup = (
    <>
      {result.lid.skirt && (
        <ZoneMesh geometry={result.lid.skirt} band={material.lid} sharedImageUrl={material.imageDataUrl} enabled={material.enabled} color="#8a6d3b" />
      )}
      {result.lid.top && (
        <ZoneMesh geometry={result.lid.top} band={material.lid} sharedImageUrl={material.imageDataUrl} enabled={material.enabled} color="#8a6d3b" />
      )}
    </>
  );

  return (
    // ANASU's geometry is Z-up (height = Z, matching SketchUp); Three.js is
    // Y-up by default, so the whole product is rotated once here rather than
    // rewriting every formula in the geometry engine.
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {bodyBands.map((geometry, i) => (
        <ZoneMesh
          key={material.bands[i]?.id ?? i}
          geometry={geometry}
          band={material.bands[i] ?? material.bands[material.bands.length - 1]}
          sharedImageUrl={material.imageDataUrl}
          enabled={material.enabled}
          color="#c9a24b"
        />
      ))}
      {result.bottomCap && (
        <ZoneMesh geometry={result.bottomCap} band={material.bottom} sharedImageUrl={material.imageDataUrl} enabled={material.enabled} color="#c9a24b" />
      )}
      {liftLid ? <group position={[0, 0, LID_LIFT_MM]}>{lidGroup}</group> : lidGroup}
      {samples && <RingTubes samples={samples} material={material} />}
      {/* Handle centerlines: just a guide so a handle shows up on the Solid
          view too, same as ANASU draws them without needing the frame. */}
      {/* depthTest=false: the handle sits right at the mouth rim, and the
          thin body shell there causes z-fighting that hides a normal line. */}
      {handlePaths.map((pts, i) => (
        <Line key={i} points={pts} color="#2f6fb3" lineWidth={2.5} depthTest={false} />
      ))}
    </group>
  );
}

export default function ProductScene({
  result,
  samples,
  handlePaths,
  bounds,
  material,
  liftLid = false,
}: {
  result: SolidLike;
  samples?: Sample[];
  handlePaths: THREE.Vector3[][];
  bounds: Bounds3D;
  material: MaterialInput;
  liftLid?: boolean;
}) {
  return (
    <Viewport3D label="Solid" bounds={bounds}>
      <SolidMesh result={result} samples={samples} handlePaths={handlePaths} material={material} liftLid={liftLid} />
    </Viewport3D>
  );
}
