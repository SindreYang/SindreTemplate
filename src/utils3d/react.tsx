"use client";

import { Suspense, type ReactNode } from "react";
import { Canvas, type CanvasProps, type ThreeElements } from "@react-three/fiber";
import { Center, Clone, Grid, OrbitControls, useGLTF } from "@react-three/drei";

export interface Scene3DProps extends Omit<CanvasProps, "children" | "fallback"> {
  children?: ReactNode;
  className?: string;
  controls?: boolean;
  grid?: boolean;
  fallback?: ReactNode;
}

/** React scene with sensible light, camera and optional Drei helpers. Give the parent a height. */
export function Scene3D({ children, className, controls = true, grid = false, fallback, camera = { position: [3, 2, 5], fov: 50 }, ...canvasProps }: Scene3DProps) {
  return <div className={className ?? "h-80 w-full"}>
    <Canvas camera={camera} fallback={fallback} {...canvasProps}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} />
      <Suspense fallback={null}>{children}</Suspense>
      {grid && <Grid infiniteGrid fadeDistance={30} sectionColor="#888" cellColor="#555" />}
      {controls && <OrbitControls makeDefault />}
    </Canvas>
  </div>;
}

export interface Model3DProps extends Omit<ThreeElements["group"], "children"> {
  src: string;
  center?: boolean;
}

/** Render independent scene instances while sharing the GLTF loader cache. Use inside Scene3D. */
export function Model3D({ src, center = false, ...props }: Model3DProps) {
  const { scene } = useGLTF(src);
  return <group {...props}>{center ? <Center><Clone object={scene} /></Center> : <Clone object={scene} />}</group>;
}

export function preload_model(src: string): void { useGLTF.preload(src); }

// Keep the commonly needed Drei primitives available from the same dedicated entry.
export { OrbitControls, Grid, Center, Environment, Bounds, GizmoHelper, GizmoViewport, Html, useGLTF } from "@react-three/drei";
export { Canvas, useFrame, useThree } from "@react-three/fiber";
