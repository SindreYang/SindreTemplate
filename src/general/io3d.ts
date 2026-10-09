import { Object3D, BufferGeometry, Mesh } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { PLYExporter } from "three/addons/exporters/PLYExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { get_gltf, get_obj, get_ply, get_stl } from "../utils3d/algorithms.js";
import { load as load_bytes, save as save_bytes, type LoadOptions, type LoadSource, type SaveDestination } from "./io.js";

function extension(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name.split(/[?#]/, 1)[0] ?? "")?.[1]?.toLowerCase() ?? "";
}

function fileReaderAvailable(): boolean {
  return typeof FileReader !== "undefined";
}

let fileReaderUsers = 0;
let installedFileReader: typeof FileReader | undefined;

async function withFileReader<T>(operation: () => Promise<T>): Promise<T> {
  if (fileReaderAvailable() && FileReader !== installedFileReader) return operation();
  class NodeFileReader {
    result: ArrayBuffer | string | null = null;
    onloadend: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    readAsArrayBuffer(blob: Blob) { void this.read(blob, false); }
    readAsDataURL(blob: Blob) { void this.read(blob, true); }
    private async read(blob: Blob, dataURL: boolean) {
      try {
        const buffer = await blob.arrayBuffer();
        this.result = dataURL ? `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}` : buffer;
        this.onloadend?.(new Event("loadend"));
      } catch {
        this.onerror?.(new Event("error"));
        this.onloadend?.(new Event("loadend"));
      }
    }
  }
  if (!fileReaderUsers++) {
    installedFileReader = NodeFileReader as unknown as typeof FileReader;
    Object.defineProperty(globalThis, "FileReader", { value: installedFileReader, configurable: true });
  }
  try { return await operation(); }
  finally {
    if (!--fileReaderUsers) {
      if (globalThis.FileReader === installedFileReader) Reflect.deleteProperty(globalThis, "FileReader");
      installedFileReader = undefined;
    }
  }
}

export async function load<T = unknown>(source: LoadSource, options: LoadOptions = {}): Promise<T> {
  const bytes = await load_bytes<Uint8Array>(source, { ...options, as: "bytes" });
  const name = source instanceof URL ? source.href : source instanceof Response ? source.url : source instanceof Blob ? ("name" in source ? String(source.name) : "") : String(source);
  const ext = extension(name);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  if (ext === "glb" || ext === "gltf") return await get_gltf(buffer, options.resourcePath ?? "") as T;
  if (ext === "ply") return await get_ply(buffer) as T;
  if (ext === "stl") return await get_stl(buffer) as T;
  if (ext === "obj") return await get_obj(new TextDecoder().decode(bytes)) as T;
  throw new TypeError(`Unsupported 3D extension: .${ext || "unknown"}`);
}

export async function save(value: unknown, destination: SaveDestination): Promise<void> {
  const name = typeof destination === "string" ? destination : destination.name;
  const ext = extension(name);
  const candidate = value instanceof Object3D || value instanceof BufferGeometry ? value : typeof value === "object" && value !== null && "scene" in value ? value.scene : undefined;
  const object = candidate instanceof BufferGeometry ? new Mesh(candidate) : candidate;
  if (!(object instanceof Object3D)) throw new TypeError("3D save requires a Three.js Object3D, BufferGeometry or GLTF result");
  let output: ArrayBuffer | string | object;
  if (ext === "glb" || ext === "gltf") {
    const animations = typeof value === "object" && value !== null && "animations" in value ? value.animations : undefined;
    output = await withFileReader(() => new GLTFExporter().parseAsync(object, {
      binary: ext === "glb", embedImages: true, ...(Array.isArray(animations) ? { animations } : {}),
    }));
  } else if (ext === "ply") {
    const ply = new PLYExporter().parse(object, undefined!, { binary: true });
    if (ply === null) throw new TypeError("PLY export requires a mesh or point cloud");
    output = ply;
  } else if (ext === "stl") output = new STLExporter().parse(object, { binary: true });
  else if (ext === "obj") output = new OBJExporter().parse(object);
  else throw new TypeError(`Unsupported 3D extension: .${ext || "unknown"}`);
  const bytes = output instanceof ArrayBuffer ? new Uint8Array(output) : ArrayBuffer.isView(output) ? new Uint8Array(output.buffer, output.byteOffset, output.byteLength) : new TextEncoder().encode(typeof output === "string" ? output : JSON.stringify(output));
  await save_bytes(bytes, destination);
}

export type { LoadOptions, LoadSource, SaveDestination } from "./io.js";
