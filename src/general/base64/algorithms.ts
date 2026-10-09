import { load, type LoadSource } from "../io.js";

export type BinaryInput = ArrayBuffer | ArrayBufferView;
export type Base64FileInput = BinaryInput | LoadSource;
export interface Base64Options { dataUrl?: boolean; mimeType?: string; signal?: AbortSignal }

function bytesOf(input: BinaryInput): Uint8Array {
  return input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

/** Encode arbitrary file bytes, preserving no information other than the bytes. */
export function bytes_to_base64(input: BinaryInput): string {
  const bytes = bytesOf(input);
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 24_576) {
    const chunk = bytes.subarray(i, i + 24_576);
    let binary = "";
    for (const byte of chunk) binary += String.fromCharCode(byte);
    parts.push(btoa(binary));
  }
  return parts.join("");
}

function parseBase64(value: string): { encoded: string; mimeType?: string } {
  const data = /^data:([^,]*?);base64,([\s\S]*)$/i.exec(value);
  const raw = (data ? data[2] : value).replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const match = /^([A-Za-z0-9+/]*)(={0,2})$/.exec(raw);
  if (!match || match[1].length % 4 === 1 || (match[2].length > 0 && (
    raw.length % 4 !== 0 || match[1].length % 4 !== 4 - match[2].length
  ))) {
    throw new TypeError("Invalid base64 data");
  }
  const encoded = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=");
  return { encoded, mimeType: data?.[1]?.split(";")[0] || undefined };
}

/** Accept raw base64, URL-safe base64 or a base64 data URL. */
export function base64_to_bytes(value: string): Uint8Array {
  const { encoded } = parseBase64(value);
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(encoded, "base64"));
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64_to_blob(value: string, mimeType?: string): Blob {
  const parsed = parseBase64(value);
  const bytes = new Uint8Array(base64_to_bytes(parsed.encoded));
  return new Blob([bytes.buffer], { type: mimeType ?? parsed.mimeType ?? "application/octet-stream" });
}

export function base64_to_file(value: string, filename: string, mimeType?: string): File {
  if (typeof File === "undefined") throw new Error("File is unavailable in this runtime; use base64_to_bytes or base64_to_blob");
  const blob = base64_to_blob(value, mimeType);
  return new File([blob], filename, { type: blob.type });
}

/** Paths and URLs are read as raw bytes through general.load. Large files occupy memory. */
export async function file_to_base64(source: Base64FileInput, { dataUrl = false, mimeType, signal }: Base64Options = {}): Promise<string> {
  signal?.throwIfAborted();
  const bytes = typeof source === "string" || source instanceof URL || source instanceof Response ||
    (typeof source === "object" && source !== null && "getFile" in source)
    ? await load<Uint8Array>(source, { as: "bytes", signal })
    : source instanceof Blob ? new Uint8Array(await source.arrayBuffer()) : bytesOf(source);
  signal?.throwIfAborted();
  const encoded = bytes_to_base64(bytes);
  if (!dataUrl) return encoded;
  const type = mimeType || (source instanceof Blob ? source.type : "") || "application/octet-stream";
  return `data:${type};base64,${encoded}`;
}
