import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { base64_to_blob, base64_to_bytes, base64_to_file, bytes_to_base64, copy_text, create_fixed_window_limiter, create_history, create_versioned_store, debounce, decrypt, download_file, download_files, encrypt, file_to_base64, get_battery_status, get_network_status, get_system_status, load, save, save_file_with_picker, throttle, to_slug, upload_file, upload_zip, zip_folder } from "../src/general/index.ts";

test("history supports bounded undo/redo and transient replacement", () => {
  const history = create_history(0, { limit: 3 });
  history.commit(1); history.commit(2); history.commit(3); history.commit(4);
  expect(history.size()).toBe(3);
  expect(history.get()).toBe(4);
  expect(history.undo()).toBe(3);
  history.replace(3.5);
  expect(history.get()).toBe(3.5);
  expect(history.undo()).toBe(2);
  expect(history.can_undo()).toBe(false);
  expect(history.redo()).toBe(3.5);
  history.commit(9);
  expect(history.can_redo()).toBe(false);
  expect(history.reset()).toBe(0);
});

test("versioned store serializes updates and rejects stale writes", async () => {
  let current = { value: { count: 0 }, version: 0 };
  const store = create_versioned_store({
    read: () => current,
    write: (value: { count: number }) => (current = { value, version: current.version + 1 }),
  });
  const first = await store.read();
  expect(await store.update(first.version, (value) => ({ count: value.count + 1 }))).toEqual({ ok: true, value: { count: 1 }, version: 1 });
  expect(await store.update(first.version, (value) => ({ count: value.count + 1 }))).toMatchObject({ ok: false, reason: "conflict" });
  const results = await Promise.all([
    store.update(1, async (value) => ({ count: value.count + 1 })),
    store.update(1, async (value) => ({ count: value.count + 1 })),
  ]);
  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(current.value.count).toBe(2);
});

test("fixed window limiter reports remaining attempts and expiry", () => {
  let time = 100;
  const limiter = create_fixed_window_limiter({ max: 2, window_ms: 1000, now: () => time });
  expect(limiter.check("ip").remaining).toBe(2);
  limiter.record("ip");
  expect(limiter.record("ip")).toMatchObject({ limited: true, remaining: 0 });
  expect(limiter.check("ip").retry_after_ms).toBe(1000);
  time += 1000;
  expect(limiter.check("ip")).toMatchObject({ limited: false, remaining: 2 });
  limiter.record("ip");
  limiter.reset("ip");
  expect(limiter.check("ip").remaining).toBe(2);
});

test("fixed window limiter bounds unique keys", () => {
  const limiter = create_fixed_window_limiter({ max: 1, window_ms: 1000, max_entries: 2, now: () => 10 });
  limiter.record("a"); limiter.record("b"); limiter.record("c");
  expect(limiter.check("c").limited).toBe(true);
});

test("to_slug normalizes Unicode text without dependencies", () => {
  expect(to_slug("  SindreJS：后台 3D 编辑器  ")).toBe("sindrejs-后台-3d-编辑器");
  expect(to_slug("!!!", "new-article")).toBe("new-article");
});

test("file picker helper fails clearly outside browser support", async () => {
  await expect(save_file_with_picker("text", { suggestedName: "note.txt" })).rejects.toThrow("File System Access");
});

test("file picker helper delegates format-specific writers", async () => {
  const previous = globalThis.showSaveFilePicker;
  let written: unknown;
  globalThis.showSaveFilePicker = async () => ({ name: "model.glb" }) as never;
  try {
    await save_file_with_picker({ scene: true }, { suggestedName: "model.glb" }, async (value) => { written = value; });
    expect(written).toEqual({ scene: true });
  } finally {
    if (previous) globalThis.showSaveFilePicker = previous;
    else Reflect.deleteProperty(globalThis, "showSaveFilePicker");
  }
});

test("arbitrary file bytes round trip through base64 and data URLs", async () => {
  const raw = Uint8Array.of(0, 1, 128, 255);
  const encoded = bytes_to_base64(raw);
  expect(base64_to_bytes(encoded)).toEqual(raw);
  expect(base64_to_bytes(encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""))).toEqual(raw);
  const file = new File([raw], "sample.bin", { type: "application/octet-stream" });
  const url = await file_to_base64(file, { dataUrl: true });
  expect(url).toStartWith("data:application/octet-stream;base64,");
  expect(new Uint8Array(await base64_to_blob(url).arrayBuffer())).toEqual(raw);
  expect(new Uint8Array(await base64_to_file(url, "copy.bin").arrayBuffer())).toEqual(raw);
  expect(await file_to_base64(new Response(raw))).toBe(encoded);
  expect(() => base64_to_bytes("not base64! ")).toThrow(TypeError);
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-base64-"));
  try {
    const path = join(dir, "any.unknown");
    await save(raw, path);
    expect(await file_to_base64(path)).toBe(encoded);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("timed callbacks cancel, flush and keep the latest trailing value", async () => {
  const values: number[] = [];
  const delayed = debounce((value: number) => values.push(value), 10);
  delayed(1); delayed(2); delayed.flush();
  expect(values).toEqual([2]);
  delayed(3); delayed.cancel();
  await Bun.sleep(20);
  expect(values).toEqual([2]);
  const limited = throttle((value: number) => values.push(value), 10);
  limited(4); limited(5); limited(6);
  limited.flush();
  expect(values).toEqual([2, 4, 6]);
  limited.cancel();
});

test("runtime status and clipboard fail safely outside a browser", async () => {
  expect(get_network_status()).toEqual({ online: null });
  expect(get_system_status().visibility).toBe("unknown");
  expect(await get_battery_status()).toBeNull();
  await expect(copy_text("hello")).rejects.toThrow("Clipboard is unavailable");
});

test("load/save chooses JSON, text and binary and supports browser handles", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-general-"));
  try {
    await save({ label: "中文" }, join(dir, "data.json"));
    await save("hello", join(dir, "note.md"));
    await save(Uint8Array.of(0, 255), join(dir, "raw.bin"));
    await save(new TextEncoder().encode('{"raw":true}'), join(dir, "download.json"));
    expect(await load(join(dir, "data.json"))).toEqual({ label: "中文" });
    expect(await load(join(dir, "note.md"))).toBe("hello");
    expect(await load(join(dir, "raw.bin"))).toEqual(Uint8Array.of(0, 255));
    expect(await load(join(dir, "download.json"))).toEqual({ raw: true });
    expect(await load(new Response('{"ok":true}', { headers: { "content-type": "application/json" } }))).toEqual({ ok: true });
    let written = "";
    const handle = { name: "note.txt", getFile: async () => new File([written], "note.txt"), createWritable: async () => ({ write: async (b: Uint8Array) => { written = new TextDecoder().decode(b); }, close: async () => {}, abort: async () => {} }) };
    await save("browser", handle);
    expect(await load(handle)).toBe("browser");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("save replaces local files atomically during concurrent writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-atomic-save-"));
  try {
    const path = join(dir, "state.json");
    await Promise.all(Array.from({ length: 20 }, (_, index) => save({ index, valid: true }, path)));
    const result = await load<{ index: number; valid: boolean }>(path);
    expect(result.valid).toBe(true);
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(await readdir(dir)).toEqual(["state.json"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("load and save .env without touching process.env", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-env-"));
  try {
    const path = join(dir, ".env.local");
    await save({ API_URL: "https://example.com/a#b", PORT: 8080, FLAG: true }, path);
    expect(await load(path)).toEqual({ API_URL: "https://example.com/a#b", PORT: "8080", FLAG: "true" });
    expect(process.env.API_URL).toBeUndefined();
    expect(await load(new File(["# comment\nexport A='a # b'\nB=first # tail\nC=\"line\\nnext\"\n"], ".env")))
      .toEqual({ A: "a # b", B: "first", C: "line\nnext" });
    await expect(save({ "BAD-KEY": "value" }, path)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("zip_folder preserves nested paths and skips symlinks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-zip-"));
  try {
    await mkdir(join(dir, "nested"));
    await mkdir(join(dir, "empty"));
    await writeFile(join(dir, "nested", "a.txt"), "A");
    await symlink(join(dir, "nested", "a.txt"), join(dir, "link.txt"));
    const archive = unzipSync(await zip_folder(dir));
    expect(Object.keys(archive).sort()).toEqual(["empty/", "nested/a.txt"]);
    expect(new TextDecoder().decode(archive["nested/a.txt"])).toBe("A");
    const files = [new File(["B"], "b.txt")];
    expect(Object.keys(unzipSync(await zip_folder(files)))).toEqual(["b.txt"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("upload and download use multipart, preserve order and bound concurrency", async () => {
  let active = 0;
  let peak = 0;
  const adapter = async (config: import("axios").InternalAxiosRequestConfig) => {
    if (config.method === "post") {
      const form = config.data as FormData;
      const blob = form.get("file") as File;
      expect(config.headers.get("content-type")?.includes("boundary=")).toBe(false);
      return { data: { name: blob.name, bytes: new Uint8Array(await blob.arrayBuffer()).length }, status: 200, statusText: "OK", headers: {}, config };
    }
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return { data: new TextEncoder().encode(String(config.url)).buffer, status: 200, statusText: "OK", headers: { "content-type": "text/plain" }, config };
  };
  const uploaded = await upload_file<{ name: string }>("https://example.com/upload", new File(["abc"], "a.txt"), { adapter });
  expect(uploaded.name).toBe("a.txt");
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-upload-"));
  try {
    const path = join(dir, "data.json");
    await writeFile(path, '{"a":1}');
    const local = await upload_file<{ bytes: number }>("https://example.com/upload", path, { adapter });
    expect(local.bytes).toBe(7);
    const archivePath = join(dir, "ready.zip");
    await writeFile(archivePath, await zip_folder([new File(["z"], "z.txt")]));
    const existing = await upload_zip<{ name: string }>("https://example.com/upload", archivePath, { adapter });
    expect(existing.name).toBe("ready.zip");
  } finally { await rm(dir, { recursive: true, force: true }); }
  const zipped = await upload_zip<{ name: string }>("https://example.com/upload", [new File(["a"], "a.txt")], { adapter });
  expect(zipped.name).toBe("archive.zip");
  const files = await download_files(["https://example.com/1", "https://example.com/2", "https://example.com/3"], { adapter, concurrency: 2 });
  expect(files.map((f) => f.name)).toEqual(["1", "2", "3"]);
  expect(peak).toBe(2);
  expect(new TextDecoder().decode((await download_file("https://example.com/x", { adapter })).data)).toBe("https://example.com/x");
});

test("AES-GCM decrypts and rejects wrong password or tampered data", async () => {
  const ciphertext = await encrypt("秘密", "passphrase");
  expect(new TextDecoder().decode(await decrypt(ciphertext, "passphrase"))).toBe("秘密");
  await expect(decrypt(ciphertext, "wrong")).rejects.toThrow();
  ciphertext[ciphertext.length - 1]! ^= 1;
  await expect(decrypt(ciphertext, "passphrase")).rejects.toThrow();
});
