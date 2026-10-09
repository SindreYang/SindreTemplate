import {
  Box3, PerspectiveCamera, Raycaster, Vector2, Vector3,
  type BufferGeometry, type Material, type Mesh, type Object3D, type Texture,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

export async function get_ply(data: ArrayBuffer): Promise<BufferGeometry> {
  const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
  return new PLYLoader().parse(data);
}

export async function get_stl(data: ArrayBuffer): Promise<BufferGeometry> {
  const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
  return new STLLoader().parse(data);
}

export async function get_obj(text: string): Promise<Object3D> {
  const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
  return new OBJLoader().parse(text);
}

/** Preserve the full glTF result, including animation, material, and scene hierarchy. */
export async function get_gltf(source: string | ArrayBuffer, resourcePath = ""): Promise<GLTF> {
  const loader = new GLTFLoader();
  return withProgressEvent(() => typeof source === "string" ? loader.loadAsync(source)
    : loader.parseAsync(source, resourcePath));
}

let progressUsers = 0;
let installedProgress: typeof ProgressEvent | undefined;

async function withProgressEvent<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof ProgressEvent !== "undefined" && ProgressEvent !== installedProgress) return operation();
  if (!progressUsers++) {
    installedProgress = class NodeProgressEvent extends Event {
      readonly lengthComputable: boolean;
      readonly loaded: number;
      readonly total: number;
      constructor(type: string, init: ProgressEventInit = {}) {
        super(type);
        this.lengthComputable = init.lengthComputable ?? false;
        this.loaded = init.loaded ?? 0;
        this.total = init.total ?? 0;
      }
    } as typeof ProgressEvent;
    Object.defineProperty(globalThis, "ProgressEvent", { value: installedProgress, configurable: true });
  }
  try { return await operation(); }
  finally {
    if (!--progressUsers) {
      if (globalThis.ProgressEvent === installedProgress) Reflect.deleteProperty(globalThis, "ProgressEvent");
      installedProgress = undefined;
    }
  }
}

/** Move a perspective camera so the complete object fits vertically and horizontally. */
export function set_camera_to_object(
  camera: PerspectiveCamera, object: Object3D, padding = 1.2,
): { center: Vector3; distance: number } {
  if (!Number.isFinite(padding) || padding <= 0) throw new RangeError("padding must be positive");
  if (!Number.isFinite(camera.aspect) || camera.aspect <= 0 ||
      !Number.isFinite(camera.fov) || camera.fov <= 0 || camera.fov >= 180) {
    throw new RangeError("camera needs a valid aspect ratio and FOV");
  }
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error("object has no measurable bounds");
  const center = box.getCenter(new Vector3());
  const direction = camera.position.clone().sub(center);
  if (direction.lengthSq() === 0) direction.set(0, 0, 1);
  if (!Number.isFinite(camera.zoom) || camera.zoom <= 0) throw new RangeError("camera needs a positive zoom");
  direction.normalize();
  camera.position.copy(center).add(direction);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const tanY = Math.tan(camera.fov * Math.PI / 360) / camera.zoom;
  const tanX = tanY * camera.aspect;
  let distance = 0;
  let depth = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new Vector3(x, y, z).sub(center);
    const forwardOffset = point.dot(direction);
    depth = Math.max(depth, forwardOffset);
    distance = Math.max(distance, forwardOffset + padding * Math.max(
      Math.abs(point.dot(right)) / tanX, Math.abs(point.dot(up)) / tanY,
    ));
  }
  distance = Math.max(distance, depth + 0.001);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(0.0001, (distance - depth) / 100);
  camera.far = Math.max(camera.near + 1, distance + depth + box.getSize(new Vector3()).length());
  camera.updateProjectionMatrix();
  return { center, distance };
}

/** Pointer coordinates are CSS pixels relative to the viewport's DOM rectangle. */
export function get_picked_object(
  clientX: number, clientY: number, viewport: Element,
  camera: PerspectiveCamera, objects: Object3D[],
) {
  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  camera.updateMatrixWorld();
  const point = new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new Raycaster();
  raycaster.setFromCamera(point, camera);
  return raycaster.intersectObjects(objects, true)[0] ?? null;
}

/** Only call when this object owns its geometry/materials (shared resources must survive). */
export function dispose_object(object: Object3D, { textures = false } = {}): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const maps = new Set<Texture>();
  object.traverse((item) => {
    const mesh = item as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        if (textures) {
          for (const value of Object.values(material)) {
            if (value && typeof value === "object" && (value as Texture).isTexture) maps.add(value as Texture);
          }
        }
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const map of maps) map.dispose();
}

/** Local-space positions and indexed triangles, or SculptGL-style padded quads. */
export interface EditableMesh {
  vertices: Float32Array;
  faces: Uint32Array;
  face_stride?: 3 | 4;
}

export interface MeshTopology {
  neighbors: number[][];
  boundary: Uint8Array;
}

export interface MeshRegion {
  indices: Uint32Array;
  weights: Float32Array;
}

const TRI_INDEX = 0xffffffff;

/** Build reusable one-ring neighbors. Rebuild after faces or vertex count changes. */
export function get_mesh_topology(mesh: EditableMesh): MeshTopology {
  const { vertices, faces } = mesh;
  const stride = mesh.face_stride ?? 3;
  if (stride !== 3 && stride !== 4) throw new RangeError("face_stride must be 3 or 4");
  if (vertices.length % 3 || faces.length % stride) throw new RangeError("invalid mesh array lengths");
  if (vertices.some(v => !Number.isFinite(v))) throw new RangeError("mesh vertices must be finite");
  const count = vertices.length / 3;
  const rings = Array.from({ length: count }, () => new Set<number>());
  const edges = new Map<string, number>();
  for (let f = 0; f < faces.length; f += stride) {
    const ids = Array.from(faces.subarray(f, f + stride));
    if (stride === 4 && ids[3] === TRI_INDEX) ids.pop();
    if (new Set(ids).size !== ids.length || ids.some(id => id >= count)) {
      throw new RangeError("face contains a duplicate or out-of-range vertex");
    }
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      rings[a].add(b); rings[b].add(a);
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const boundary = new Uint8Array(count);
  for (const [key, appearances] of edges) {
    if (appearances === 2) continue;
    const [a, b] = key.split(",").map(Number);
    boundary[a] = boundary[b] = 1;
  }
  return { neighbors: rings.map(ring => [...ring]), boundary };
}

/** Select one connected surface region; seed_index should come from the hit face on thin meshes. */
export function get_mesh_region(
  mesh: EditableMesh,
  center: readonly [number, number, number],
  radius: number,
  options: { seed_index?: number; topology?: MeshTopology; mask?: ArrayLike<number>; distance?: "surface" | "spatial" } = {},
): MeshRegion {
  if (!Number.isFinite(radius) || radius <= 0 || center.some(v => !Number.isFinite(v))) {
    throw new RangeError("center and radius must be finite; radius must be positive");
  }
  const vertices = mesh.vertices;
  const count = vertices.length / 3;
  const topology = options.topology ?? get_mesh_topology(mesh);
  if (!Number.isInteger(count) || topology.neighbors.length !== count || topology.boundary.length !== count) {
    throw new RangeError("topology does not match mesh vertices");
  }
  if (options.mask && options.mask.length !== count) throw new RangeError("mask length must match vertex count");
  if (options.distance && options.distance !== "surface" && options.distance !== "spatial") {
    throw new RangeError("distance must be surface or spatial");
  }
  let seed = options.seed_index ?? -1;
  if (seed !== -1 && (!Number.isSafeInteger(seed) || seed < 0 || seed >= count)) {
    throw new RangeError("seed_index is outside the mesh");
  }
  if (seed < 0) {
    let best = Infinity;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const d = Math.hypot(vertices[j] - center[0], vertices[j + 1] - center[1], vertices[j + 2] - center[2]);
      if (d < best) { best = d; seed = i; }
    }
  }
  if (seed < 0) return { indices: new Uint32Array(), weights: new Float32Array() };

  const spatial = (id: number) => {
    const j = id * 3;
    return Math.hypot(vertices[j] - center[0], vertices[j + 1] - center[1], vertices[j + 2] - center[2]);
  };
  const distances = new Float64Array(count).fill(Infinity);
  const heap: Array<[number, number]> = [];
  const push = (d: number, id: number) => {
    let i = heap.length;
    heap.push([d, id]);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= d) break;
      heap[i] = heap[p]; i = p;
    }
    heap[i] = [d, id];
  };
  const pop = (): [number, number] => {
    const first = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length && heap[child + 1][0] < heap[child][0]) child++;
        if (last[0] <= heap[child][0]) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const initial = spatial(seed);
  if (initial >= radius) return { indices: new Uint32Array(), weights: new Float32Array() };
  distances[seed] = initial;
  push(initial, seed);
  const indices: number[] = [];
  const weights: number[] = [];
  while (heap.length) {
    const [d, id] = pop();
    if (d !== distances[id] || d >= radius) continue;
    const t = d / radius;
    const weight = 1 - 4 * t ** 3 + 3 * t ** 4;
    const mask = options.mask?.[id] ?? 1;
    if (!Number.isFinite(mask) || mask < 0 || mask > 1) throw new RangeError("mask values must be in [0, 1]");
    if (mask * weight > 0) { indices.push(id); weights.push(mask * weight); }
    for (const next of topology.neighbors[id]) {
      const j = id * 3, k = next * 3;
      const edge = Math.hypot(vertices[j] - vertices[k], vertices[j + 1] - vertices[k + 1], vertices[j + 2] - vertices[k + 2]);
      const nd = options.distance === "spatial" ? spatial(next) : d + edge;
      if (nd < radius && nd < distances[next]) { distances[next] = nd; push(nd, next); }
    }
  }
  return { indices: Uint32Array.from(indices), weights: Float32Array.from(weights) };
}

function check_region(mesh: EditableMesh, region: MeshRegion): void {
  if (mesh.vertices.length % 3 || region.indices.length !== region.weights.length) throw new RangeError("invalid mesh or region");
  const seen = new Set<number>();
  for (let i = 0; i < region.indices.length; i++) {
    if (region.indices[i] >= mesh.vertices.length / 3 || !Number.isFinite(region.weights[i]) ||
        region.weights[i] < 0 || region.weights[i] > 1 || seen.has(region.indices[i])) throw new RangeError("invalid region index or weight");
    seen.add(region.indices[i]);
  }
}

/** Pull the original surface without changing topology. delta is in mesh-local units. */
export function change_mesh_by_brush(mesh: EditableMesh, region: MeshRegion, delta: readonly [number, number, number]): Float32Array {
  check_region(mesh, region);
  if (delta.length !== 3 || delta.some(v => !Number.isFinite(v))) throw new RangeError("delta must be finite 3D coordinates");
  const result = mesh.vertices.slice();
  for (let i = 0; i < region.indices.length; i++) {
    const j = region.indices[i] * 3, w = region.weights[i];
    result[j] += delta[0] * w; result[j + 1] += delta[1] * w; result[j + 2] += delta[2] * w;
  }
  return result;
}

function get_local_normals(mesh: EditableMesh, vertices: Float32Array): Float32Array {
  const normals = new Float32Array(vertices.length);
  const stride = mesh.face_stride ?? 3;
  for (let f = 0; f < mesh.faces.length; f += stride) {
    const ids = Array.from(mesh.faces.subarray(f, f + stride));
    if (stride === 4 && ids[3] === TRI_INDEX) ids.pop();
    for (let t = 1; t + 1 < ids.length; t++) {
      const a = ids[0] * 3, b = ids[t] * 3, c = ids[t + 1] * 3;
      const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
      const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      for (const id of [ids[0], ids[t], ids[t + 1]]) {
        const j = id * 3; normals[j] += x; normals[j + 1] += y; normals[j + 2] += z;
      }
    }
  }
  for (let j = 0; j < normals.length; j += 3) {
    const length = Math.hypot(normals[j], normals[j + 1], normals[j + 2]);
    if (length > 0) { normals[j] /= length; normals[j + 1] /= length; normals[j + 2] /= length; }
  }
  return normals;
}

/** One-ring smoothing; tangent mode avoids most normal-direction shrinkage. */
export function smooth_mesh_region(
  mesh: EditableMesh, region: MeshRegion,
  options: { strength?: number; iterations?: number; tangent?: boolean; boundary?: "slide" | "fixed" | "free"; topology?: MeshTopology } = {},
): Float32Array {
  check_region(mesh, region);
  const strength = options.strength ?? 0.5, iterations = options.iterations ?? 1;
  if (!Number.isFinite(strength) || strength < 0 || strength > 1 || !Number.isSafeInteger(iterations) || iterations < 0) {
    throw new RangeError("strength must be in [0, 1] and iterations must be a nonnegative integer");
  }
  const topology = options.topology ?? get_mesh_topology(mesh);
  if (topology.neighbors.length !== mesh.vertices.length / 3 || topology.boundary.length !== topology.neighbors.length) {
    throw new RangeError("topology does not match mesh vertices");
  }
  const boundary = options.boundary ?? "slide";
  if (!["slide", "fixed", "free"].includes(boundary)) throw new RangeError("invalid boundary mode");
  let current = mesh.vertices.slice();
  for (let pass = 0; pass < iterations; pass++) {
    const next = current.slice();
    const normals = options.tangent ? get_local_normals(mesh, current) : undefined;
    for (let i = 0; i < region.indices.length; i++) {
      const id = region.indices[i], j = id * 3;
      if (boundary === "fixed" && topology.boundary[id]) continue;
      const neighbors = topology.neighbors[id].filter(n => boundary !== "slide" || !topology.boundary[id] || topology.boundary[n]);
      if (!neighbors.length) continue;
      let x = 0, y = 0, z = 0;
      for (const n of neighbors) { const k = n * 3; x += current[k]; y += current[k + 1]; z += current[k + 2]; }
      x = x / neighbors.length - current[j]; y = y / neighbors.length - current[j + 1]; z = z / neighbors.length - current[j + 2];
      if (normals) {
        const nx = normals[j], ny = normals[j + 1], nz = normals[j + 2];
        if (nx === 0 && ny === 0 && nz === 0) continue;
        const dot = x * nx + y * ny + z * nz;
        x -= dot * nx; y -= dot * ny; z -= dot * nz;
      }
      const scale = strength * region.weights[i];
      next[j] += x * scale; next[j + 1] += y * scale; next[j + 2] += z * scale;
    }
    current = next;
  }
  return current;
}

/** Move selected vertices toward a caller-defined local-space plane. */
export function flatten_mesh_region(
  mesh: EditableMesh, region: MeshRegion,
  plane: { point: readonly [number, number, number]; normal: readonly [number, number, number]; strength?: number },
): Float32Array {
  check_region(mesh, region);
  const { point, normal } = plane;
  const strength = plane.strength ?? 1;
  if (point.length !== 3 || normal.length !== 3 || [...point, ...normal, strength].some(v => !Number.isFinite(v)) ||
      strength < 0 || strength > 1) throw new RangeError("invalid plane or strength");
  const length = Math.hypot(...normal);
  if (length === 0) throw new RangeError("plane normal cannot be zero");
  const nx = normal[0] / length, ny = normal[1] / length, nz = normal[2] / length;
  const result = mesh.vertices.slice();
  for (let i = 0; i < region.indices.length; i++) {
    const j = region.indices[i] * 3;
    const d = ((result[j] - point[0]) * nx + (result[j + 1] - point[1]) * ny + (result[j + 2] - point[2]) * nz) * strength * region.weights[i];
    result[j] -= nx * d; result[j + 1] -= ny * d; result[j + 2] -= nz * d;
  }
  return result;
}
