import axios, { AxiosHeaders, type AxiosAdapter, type AxiosInstance } from "axios";

const fsSpecifier: string = "node:fs/promises";
const pathSpecifier: string = "node:path";

export type FileInput = string | Iterable<File>;

export interface TransferOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  client?: AxiosInstance;
  adapter?: AxiosAdapter;
}

export interface DownloadedFile {
  name: string;
  data: Uint8Array;
  contentType: string;
}

function filename(url: string): string {
  const name = new URL(url, "https://local.invalid").pathname.split("/").pop() || "download";
  try { return decodeURIComponent(name); } catch { return name; }
}

export async function download_file(url: string, options: TransferOptions = {}): Promise<DownloadedFile> {
  const response = await (options.client ?? axios).get<ArrayBuffer | Uint8Array>(url, {
    headers: options.headers, signal: options.signal, adapter: options.adapter, responseType: "arraybuffer",
  });
  return {
    name: filename(url),
    contentType: String(response.headers["content-type"] ?? "application/octet-stream"),
    data: new Uint8Array(response.data),
  };
}

/** Bounded parallelism with stable result order. */
export async function download_files(
  urls: readonly string[], options: TransferOptions & { concurrency?: number } = {},
): Promise<DownloadedFile[]> {
  const { concurrency = 3 } = options;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new RangeError("concurrency must be positive");
  const results = new Array<DownloadedFile>(urls.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (next < urls.length) {
      const index = next++;
      results[index] = await download_file(urls[index]!, options);
    }
  }));
  return results;
}

export async function upload_file<T = unknown>(
  url: string, file: File | Blob | Uint8Array | string,
  options: TransferOptions & { fieldName?: string; filename?: string; fields?: Record<string, string> } = {},
): Promise<T> {
  const name = options.filename ?? (typeof file === "string"
    ? file.replaceAll("\\", "/").split("/").pop() || "file"
    : "name" in file ? String(file.name) : "file");
  let blob: Blob;
  if (typeof file === "string") {
    if (typeof process === "undefined" || !process.versions?.node) {
      throw new TypeError("Browser uploads require File, Blob or bytes");
    }
    const { readFile } = await import(/* webpackIgnore: true */ fsSpecifier) as typeof import("node:fs/promises");
    blob = new Blob([await readFile(file)]);
  } else blob = file instanceof Blob ? file : new Blob([file as Uint8Array<ArrayBuffer>]);
  const form = new FormData();
  for (const [key, value] of Object.entries(options.fields ?? {})) form.append(key, value);
  form.append(options.fieldName ?? "file", blob, name);
  const headers = AxiosHeaders.from(options.headers);
  headers.delete("content-type"); // Axios sets the multipart boundary for this runtime.
  const response = await (options.client ?? axios).post<T>(url, form, { headers, signal: options.signal, adapter: options.adapter });
  if (response.status === 204) return undefined as T;
  return response.data;
}

export async function upload_zip<T = unknown>(
  url: string, input: FileInput | Blob | Uint8Array,
  options: TransferOptions & { fieldName?: string; filename?: string; fields?: Record<string, string> } = {},
): Promise<T> {
  if (input instanceof Blob || input instanceof Uint8Array) {
    return upload_file<T>(url, input, { ...options, filename: options.filename ?? ("name" in input ? String(input.name) : "archive.zip") });
  }
  if (typeof input === "string") {
    if (typeof process === "undefined" || !process.versions?.node) throw new TypeError("Browser folders require File objects");
    const { lstat } = await import(/* webpackIgnore: true */ fsSpecifier) as typeof import("node:fs/promises");
    if ((await lstat(input)).isFile()) {
      if (!/\.zip$/i.test(input)) throw new TypeError("Existing archive must end in .zip");
      return upload_file<T>(url, input, options);
    }
  }
  const data = await zip_folder(input);
  return upload_file<T>(url, new Blob([data as Uint8Array<ArrayBuffer>], { type: "application/zip" }), {
    ...options, filename: options.filename ?? "archive.zip",
  });
}

function archiveName(name: string): string {
  const normalized = name.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => part === ".." || part === "")) {
    throw new TypeError(`Invalid archive name: ${name}`);
  }
  return normalized;
}

/** ZIP output is held in memory. Symlinks are skipped for local directories. */
export async function zip_folder(folder: FileInput): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = Object.create(null);
  if (typeof folder === "string") {
    if (typeof process === "undefined" || !process.versions?.node) throw new TypeError("Browser folders require an iterable of File objects");
    const [{ readdir, readFile, lstat }, { join, relative, sep }] = await Promise.all([
      import(/* webpackIgnore: true */ fsSpecifier) as Promise<typeof import("node:fs/promises")>,
      import(/* webpackIgnore: true */ pathSpecifier) as Promise<typeof import("node:path")>,
    ]);
    if (!(await lstat(folder)).isDirectory()) throw new TypeError("folder must be a directory");
    async function walk(current: string): Promise<void> {
      const entries = await readdir(current, { withFileTypes: true });
      if (!entries.length && current !== folder) {
        files[archiveName(relative(folder as string, current).split(sep).join("/")) + "/"] = new Uint8Array();
      }
      for (const entry of entries) {
        const path = join(current, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) files[archiveName(relative(folder as string, path).split(sep).join("/"))] = await readFile(path);
      }
    }
    await walk(folder);
  } else {
    for (const file of folder) {
      const name = archiveName(file.webkitRelativePath || file.name);
      if (Object.hasOwn(files, name)) throw new TypeError(`Duplicate archive name: ${name}`);
      files[name] = new Uint8Array(await file.arrayBuffer());
    }
  }
  const { zip } = await import("fflate");
  return new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (reason, data) => reason ? reject(reason) : resolve(data));
  });
}
