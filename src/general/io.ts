export type LoadSource = string | URL | Blob | Response | FileSystemFileHandle;
export type SaveDestination = string | FileSystemFileHandle;
export interface LoadOptions { signal?: AbortSignal; as?: "auto" | "bytes"; resourcePath?: string }

// Keep Node-only readers out of browser bundles generated from the general entry.
const fsSpecifier: string = "node:fs/promises";
const pathSpecifier: string = "node:path";
const urlSpecifier: string = "node:url";

const textExtensions = /\.(?:txt|md|csv|tsv|html?|xml|ya?ml|svg|css|[cm]?[jt]sx?)$/i;
const isServer = () => typeof process !== "undefined" && !!process.versions?.node;
const isWebURL = (value: string) => /^https?:\/\//i.test(value);
const isHandle = (value: unknown): value is FileSystemFileHandle =>
  typeof value === "object" && value !== null && "getFile" in value && "createWritable" in value;

function kind(name: string, mime = ""): "json" | "text" | "binary" {
  const path = name.split(/[?#]/, 1)[0] ?? "";
  if (/\.json$/i.test(path) || /\b(?:application\/json|\w+\/\w+\+json)\b/i.test(mime)) return "json";
  if (textExtensions.test(path) || /^text\//i.test(mime)) return "text";
  return "binary";
}

function extension(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name.split(/[?#]/, 1)[0] ?? "")?.[1]?.toLowerCase() ?? "";
}

const imageTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const isEnvFile = (name: string) => /(?:^|[/\\])\.env(?:\.[\w-]+)?(?:[?#]|$)/i.test(name);
const localSaveQueues = new Map<string, Promise<void>>();

function closingQuote(value: string, quote: string): number {
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== quote) continue;
    let escapes = 0;
    for (let previous = index - 1; previous >= 0 && value[previous] === "\\"; previous--) escapes++;
    if (escapes % 2 === 0) return index;
  }
  return -1;
}

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, key, raw] = match;
    const quote = raw[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      let rest = raw.slice(1);
      while (closingQuote(rest, quote) < 0 && i + 1 < lines.length) {
        rest += `\n${lines[++i]}`;
      }
      const end = closingQuote(rest, quote);
      const content = end < 0 ? rest : rest.slice(0, end);
      values[key] = quote === '"' ? content.replace(/\\(n|r|"|\\)/g, (_, escaped: string) =>
        escaped === "n" ? "\n" : escaped === "r" ? "\r" : escaped) : content;
    } else values[key] = raw.split("#", 1)[0].trim();
  }
  return values;
}

async function pathOf(value: string | URL): Promise<string> {
  if (value instanceof URL || value.startsWith("file://")) {
    const url = value instanceof URL ? value : new URL(value);
    if (url.protocol !== "file:") throw new TypeError("Only file: URLs are local paths");
    const { fileURLToPath } = await import(/* webpackIgnore: true */ urlSpecifier) as typeof import("node:url");
    return fileURLToPath(url);
  }
  return value;
}

/** JSON and text are decoded automatically by extension or MIME type; other files return bytes. */
export async function load<T = unknown>(source: LoadSource, options: LoadOptions = {}): Promise<T> {
  let bytes: Uint8Array;
  let name = "";
  let mime = "";
  if (isHandle(source)) source = await source.getFile();
  if (source instanceof Response) {
    if (!source.ok) throw new Error(`HTTP ${source.status}: ${await source.text()}`);
    name = source.url;
    mime = source.headers.get("content-type") ?? "";
    bytes = new Uint8Array(await source.arrayBuffer());
  } else if (source instanceof Blob) {
    name = "name" in source ? String(source.name) : "";
    mime = source.type;
    bytes = new Uint8Array(await source.arrayBuffer());
  } else {
    const address = source instanceof URL ? source.href : source;
    if (isWebURL(address) || (!isServer() && !(source instanceof URL && source.protocol === "file:"))) {
      const response = await fetch(address, { signal: options.signal });
      return load<T>(response, options);
    }
    if (!isServer()) throw new TypeError("Browser local files require File or FileSystemFileHandle");
    name = address;
    const { readFile } = await import(/* webpackIgnore: true */ fsSpecifier) as typeof import("node:fs/promises");
    bytes = new Uint8Array(await readFile(await pathOf(source)));
  }
  options.signal?.throwIfAborted();
  if (options.as === "bytes") return bytes as T;
  if (isEnvFile(name)) {
    return parseEnv(new TextDecoder().decode(bytes)) as T;
  }
  const ext = extension(name) || Object.keys(imageTypes).find((suffix) => imageTypes[suffix] === mime) || "";
  if (ext in imageTypes && typeof globalThis.createImageBitmap === "function") {
    return await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: mime || imageTypes[ext] })) as T;
  }
  switch (kind(name, mime)) {
    case "json": return JSON.parse(new TextDecoder().decode(bytes)) as T;
    case "text": return new TextDecoder().decode(bytes) as T;
    default: return bytes as T;
  }
}

/** Local Node/Bun path or browser File System Access handle; creates parent directories on the server. */
export async function save(value: unknown, destination: SaveDestination): Promise<void> {
  const name = typeof destination === "string" ? destination : destination.name;
  const format = kind(name);
  const ext = extension(name);
  let bytes: Uint8Array;
  if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (value instanceof Blob) bytes = new Uint8Array(await value.arrayBuffer());
  else if (isEnvFile(name) && typeof value === "object" && value !== null && !Array.isArray(value)) {
    const lines = Object.entries(value).map(([key, item]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new TypeError(`Invalid environment key: ${key}`);
      if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
        throw new TypeError(`Environment value for ${key} must be a string, number or boolean`);
      }
      return `${key}=${JSON.stringify(String(item))}`;
    });
    bytes = new TextEncoder().encode(lines.join("\n") + (lines.length ? "\n" : ""));
  }
  else if (ext in imageTypes && isBitmap(value)) {
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(value.width, value.height) :
      typeof document !== "undefined" ? document.createElement("canvas") : undefined;
    if (!canvas) throw new TypeError("ImageBitmap encoding requires Canvas support");
    canvas.width = value.width;
    canvas.height = value.height;
    canvas.getContext("2d")?.drawImage(value, 0, 0);
    const blob = await canvasBlob(canvas, imageTypes[ext]);
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else if (ext in imageTypes && isCanvasImage(value)) {
    const mime = imageTypes[ext];
    const blob = await canvasBlob(value, mime);
    bytes = new Uint8Array(await blob.arrayBuffer());
  }
  else if (format === "json") {
    const json = JSON.stringify(value);
    if (json === undefined) throw new TypeError("value cannot be serialized as JSON");
    bytes = new TextEncoder().encode(json);
  } else if (typeof value === "string" && (format === "text" || isEnvFile(name))) bytes = new TextEncoder().encode(value);
  else if (["glb", "gltf", "ply", "stl", "obj"].includes(ext)) {
    throw new TypeError("3D formats require importing from sindrejs/general/3d");
  } else throw new TypeError("Text files require a string; binary files require bytes or Blob");

  if (typeof destination !== "string") {
    const writer = await destination.createWritable();
    try { await writer.write(bytes as Uint8Array<ArrayBuffer>); await writer.close(); }
    catch (reason) { await writer.abort().catch(() => undefined); throw reason; }
    return;
  }
  if (isWebURL(destination)) throw new TypeError("Remote writes require upload_file or an application API");
  if (!isServer()) throw new TypeError("Browser save requires a FileSystemFileHandle");
  const [{ mkdir, rename, unlink, writeFile }, { dirname }] = await Promise.all([
    import(/* webpackIgnore: true */ fsSpecifier) as Promise<typeof import("node:fs/promises")>,
    import(/* webpackIgnore: true */ pathSpecifier) as Promise<typeof import("node:path")>,
  ]);
  const path = await pathOf(destination);
  await mkdir(dirname(path), { recursive: true });
  // Replace regular files atomically so a process interruption cannot leave a
  // partially-written JSON/configuration file for the next reader.
  const previous = localSaveQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const temporary = `${path}.sindrejs-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await writeFile(temporary, bytes);
      await rename(temporary, path);
    } catch (reason) {
      await unlink(temporary).catch(() => undefined);
      throw reason;
    }
  });
  localSaveQueues.set(path, current);
  try {
    await current;
  } finally {
    if (localSaveQueues.get(path) === current) localSaveQueues.delete(path);
  }
}

function isCanvasImage(value: unknown): value is HTMLCanvasElement | OffscreenCanvas {
  return typeof value === "object" && value !== null &&
    ((typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement) ||
     (typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas));
}

function isBitmap(value: unknown): value is ImageBitmap {
  return typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap;
}

function canvasBlob(canvas: HTMLCanvasElement | OffscreenCanvas, mime: string): Promise<Blob> {
  return "convertToBlob" in canvas ? canvas.convertToBlob({ type: mime }) :
    new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image encoding failed")), mime));
}
