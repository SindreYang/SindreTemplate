import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import { get_gltf, get_obj, get_ply, get_stl } from "./algorithms.js";

export type ModelFormat = "gltf" | "glb" | "obj" | "ply" | "stl";

export interface LoadedModel {
  object: Object3D;
  format: ModelFormat;
  meshes: number;
  vertices: number;
}

function formatOf(name: string): ModelFormat {
  const extension = name.split(/[?#]/, 1)[0]?.split(".").pop()?.toLowerCase();
  if (extension === "gltf" || extension === "glb" || extension === "obj" || extension === "ply" || extension === "stl") return extension;
  throw new TypeError("supported model formats are GLB, GLTF, PLY, STL and OBJ");
}

function bytesToText(source: ArrayBuffer | string): string {
  return typeof source === "string" ? source : new TextDecoder().decode(source);
}

function inspect(object: Object3D, format: ModelFormat): LoadedModel {
  let meshes = 0;
  let vertices = 0;
  object.traverse((child) => {
    const mesh = child as Object3D & { isMesh?: boolean; geometry?: { attributes?: { position?: { count: number } } } };
    if (!mesh.isMesh) return;
    meshes++;
    vertices += mesh.geometry?.attributes?.position?.count ?? 0;
  });
  return { object, format, meshes, vertices };
}

/** Loads a supported model into an Object3D and reports basic geometry statistics. */
export async function load_model(source: ArrayBuffer | string, name: string, resourcePath = ""): Promise<LoadedModel> {
  const format = formatOf(name);
  if (format === "gltf" || format === "glb") return inspect((await get_gltf(source, resourcePath)).scene, format);
  if (format === "obj") return inspect(await get_obj(bytesToText(source)), format);
  if (typeof source === "string") throw new TypeError(`${format.toUpperCase()} loading requires an ArrayBuffer`);
  const geometry = format === "ply" ? await get_ply(source) : await get_stl(source);
  return inspect(new Mesh(geometry, new MeshStandardMaterial({ color: format === "ply" ? "#5f91ff" : "#ffb56e", roughness: .38 })), format);
}
