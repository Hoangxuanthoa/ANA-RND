"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";

interface ModelProps {
  url: string;
}

function Model({ url }: ModelProps) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial color="#cccccc" wireframe />
    </mesh>
  );
}

export interface ModelViewerProps {
  /** URL to a .glb / .gltf file (e.g. a Supabase Storage public URL). */
  url: string;
  className?: string;
}

export function ModelViewer({ url, className }: ModelViewerProps) {
  return (
    <div className={className ?? "h-96 w-full"}>
      <Canvas camera={{ position: [3, 3, 3], fov: 45 }}>
        <Suspense fallback={<Loader />}>
          <Stage environment="city" intensity={0.5}>
            <Model url={url} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
