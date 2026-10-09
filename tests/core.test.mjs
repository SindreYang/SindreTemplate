import { test } from "node:test";
import assert from "node:assert/strict";
const {
  success, error, retry, sleep, load, save, safe_parse_json, lazy_module, get_logger, get_file_logger,
  SSEDecoder, read_sse_stream, get_stream_lifecycle, get_http_client, HttpError, lazy_keyed,
} = await import(process.env.SINDREJS_TEST_BUILD ? "../dist/general/index.js" : "../src/general/index.ts");
const { get_canvas_point, get_image_point, get_annotation_hit, show_annotation } = await import(
  process.env.SINDREJS_TEST_BUILD ? "../dist/utils2d/index.js" : "../src/utils2d/index.ts"
);
const { load: load3d, save: save3d } = await import(
  process.env.SINDREJS_TEST_BUILD ? "../dist/general/io3d.js" : "../src/general/io3d.ts"
);

test("Result names and automatic JSON loading", async () => {
  assert.deepEqual(success(4), { success: true, value: 4 });
  assert.deepEqual(error("bad"), { success: false, error: "bad" });
  assert.equal(safe_parse_json("not-json").success, false);
  assert.deepEqual(await load(new File(['{"a":1}'], "a.json")), { a: 1 });
});

test("general entry stays isolated from optional engines", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { cwd } = await import("node:process");
  const entry = process.env.SINDREJS_TEST_BUILD
    ? await readFile(join(cwd(), "dist/general/index.js"), "utf8")
    : await readFile(join(cwd(), "src/general/index.ts"), "utf8");
  assert.doesNotMatch(entry, /utils3d|onnxruntime|@mediapipe|@tensorflow|three/);
});

test("AI aggregate keeps native ONNX out of browser dependency traversal", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const entry = await readFile(join(process.cwd(), "dist/ai/index.js"), "utf8");
  assert.doesNotMatch(entry, /nodeOnnxPath/);
  assert.match(entry, /webpackIgnore/);
});

test("binary save rejects text while text save still works", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-binary-"));
  try {
    await assert.rejects(save("not an image", join(dir, "image.png")), TypeError);
    await save("hello", join(dir, "note.txt"));
    assert.equal(await load(join(dir, "note.txt")), "hello");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("retry stops at success or cancellation", async () => {
  let calls = 0;
  assert.equal(await retry(() => { if (++calls < 3) throw Error("temporary"); return "ok"; },
    { delayMs: 0 }), "ok");
  assert.equal(calls, 3);
  const controller = new AbortController();
  const wait = sleep(2000, controller.signal);
  controller.abort(new Error("cancelled"));
  await assert.rejects(wait, /cancelled/);
  await assert.rejects(retry(() => 1, { attempts: 0 }), RangeError);
});

test("SSE handles split UTF-8, CRLF, multiline payloads, and trailing frame", () => {
  const parser = new SSEDecoder();
  const bytes = new TextEncoder().encode("id: x\r\nevent: news\r\ndata: 你\r\ndata: 好\r\n\r\ndata: tail");
  const all = [];
  for (const byte of bytes) all.push(...parser.push(Uint8Array.of(byte)));
  all.push(...parser.push(new Uint8Array(), true));
  assert.deepEqual(all, [
    { data: "你\n好", event: "news", id: "x" },
    { data: "tail", id: "x" },
  ]);
});

test("stream lifecycle separates first and idle timeouts and settles only once", async () => {
  const phases = [], timeouts = [];
  const stream = get_stream_lifecycle({ first_timeout_ms: 15, idle_timeout_ms: 25,
    on_change: (phase) => phases.push(phase), on_timeout: (stage) => timeouts.push(stage) });
  stream.start();
  stream.activity();
  stream.wait();
  stream.done();
  await sleep(35);
  assert.equal(stream.phase, "success");
  assert.deepEqual(phases, ["connecting", "active", "waiting", "success"]);
  assert.deepEqual(timeouts, []);
  stream.start();
  await sleep(25);
  assert.equal(stream.phase, "timeout");
  assert.deepEqual(timeouts, ["first"]);
  stream.done();
  assert.equal(stream.phase, "timeout");
  stream.start();
  stream.activity();
  await sleep(35);
  assert.deepEqual(timeouts, ["first", "idle"]);
  stream.dispose();
  assert.throws(() => get_stream_lifecycle({ idle_timeout_ms: 0 }), RangeError);
});

test("dialog module renders on the server and requires its provider for actions", async () => {
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { DialogProvider, useDialog } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utilsui/dialog/index.js" : "../src/utilsui/dialog/index.tsx");
  assert.match(renderToString(React.createElement(DialogProvider, null, React.createElement("span", null, "content"))), /content/);
  assert.throws(() => renderToString(React.createElement(() => { useDialog(); return null; })), /requires DialogProvider/);
});

test("canvas viewport and adaptive panel render without browser globals", async () => {
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { CanvasViewport } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utilsui/canvas/index.js" : "../src/utilsui/canvas/index.tsx");
  const { AdaptivePanel } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utilsui/panel/index.js" : "../src/utilsui/panel/index.tsx");
  const canvas = renderToString(React.createElement(CanvasViewport, { className: "h-40" },
    ({ size, get_point }) => React.createElement("canvas", { width: size.pixelWidth, height: size.pixelHeight,
      "data-point": get_point({ clientX: 1, clientY: 2 }) === null ? "unmounted" : "mounted" })));
  assert.match(canvas, /data-point="unmounted"/);
  assert.match(canvas, /class="relative min-h-0 min-w-0 h-40"/);
  const panel = renderToString(React.createElement(AdaptivePanel,
    { title: "工具", open: false, onOpenChange() {} }, React.createElement("span", null, "选项")));
  assert.match(panel, /aria-haspopup="dialog"/);
  assert.match(panel, /data-adaptive-panel-trigger="true"/);
  assert.match(panel, /style="display:none"/);
  assert.match(panel, /<aside/);
  assert.match(panel, /data-adaptive-panel="desktop"/);
  assert.match(panel, /选项/);
});

test("agent SSE abort settles a read while the producer is idle", async () => {
  const { get_agent_sse } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utilsagent/sse.js" : "../src/utilsagent/sse.ts");
  const abort = new AbortController();
  async function* idle() { await new Promise(() => {}); yield { type: "text", text: "late" }; }
  const reader = get_agent_sse(idle(), abort.signal).body.getReader();
  const read = reader.read();
  abort.abort();
  const result = await Promise.race([read, sleep(100).then(() => "timed out")]);
  assert.deepEqual(result, { done: true, value: undefined });
  reader.releaseLock();
});

test("agent SSE has a LangChain-free entry", async () => {
  const { get_agent_sse } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utilsagent/sse.js" : "../src/utilsagent/sse.ts");
  async function* events() { yield { type: "text", text: "ready" }; }
  const response = get_agent_sse(events());
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.match(await response.text(), /event: text/);
});

test("lightweight Markdown entry stays free of optional Markdown runtime", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const root = process.cwd();
  const source = await readFile(join(root, "dist/utilsui/markdown/lite.js"), "utf8");
  assert.doesNotMatch(source, /react-markdown|remark-gfm|lucide-react/);
  const module = await import(pathToFileURL(join(root, "dist/utilsui/markdown/lite.js")).href);
  assert.equal(typeof module.MarkdownView, "function");
});

test("read_sse_stream cancels reader when consumer stops", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode("data: one\n\n")); },
    cancel() { cancelled = true; },
  }));
  for await (const event of read_sse_stream(response)) {
    assert.equal(event.data, "one");
    break;
  }
  assert.equal(cancelled, true);
});

test("HTTP client merges headers and does not retry failed writes", async () => {
  const calls = [];
  const client = get_http_client({
    baseURL: "https://example.org/api/",
    headers: { "X-Base": "yes" },
    adapter: async (config) => {
      calls.push(config);
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    },
  });
  assert.deepEqual(await client.post("items", { x: 1 }), { ok: true });
  assert.deepEqual(await client.post("logout"), { ok: true });
  assert.deepEqual(await client.delete("items/1"), { ok: true });
  assert.equal(calls[0].baseURL, "https://example.org/api/");
  assert.equal(calls[0].url, "items");
  assert.equal(calls[0].headers.get("x-base"), "yes");
  assert.equal(calls[0].headers.get("content-type"), "application/json");
  assert.equal(calls.length, 3);
  assert.equal(calls[2].method, "delete");
  const { AxiosError } = await import("axios");
  const bad = get_http_client({ baseURL: "https://example.org/", adapter: async (config) => {
    const response = { data: "oops", status: 500, statusText: "Bad", headers: {}, config };
    throw new AxiosError("bad", "ERR_BAD_RESPONSE", config, undefined, response);
  } });
  await assert.rejects(bad.get("broken"), HttpError);
});

test("Canvas transform round-trip and rotated box hit detection", () => {
  const view = { scale: 2, offsetX: 12, offsetY: -7 };
  assert.deepEqual(get_image_point(get_canvas_point({ x: 5, y: 4 }, view), view), { x: 5, y: 4 });
  const obb = { kind: "rotatedRect", cx: 10, cy: 10, width: 8, height: 4, angle: Math.PI / 2 };
  assert.equal(get_annotation_hit(obb, { x: 10, y: 13 }, 0), true);
  assert.equal(get_annotation_hit(obb, { x: 13, y: 10 }, 0), false);
  assert.equal(get_annotation_hit({ kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }, { x: 2, y: 2 }, 0), true);
});

test("Canvas drawing restores caller state", () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
  show_annotation(ctx, { kind: "keypoint", x: 2, y: 3 }, { scale: 2, offsetX: 0, offsetY: 0 });
  assert.equal(calls[0][0], "save");
  assert.equal(calls.at(-1)[0], "restore");
});

test("3D spline samples and screen insertion use stable control segments", async () => {
  const { get_catmull_rom_points, get_curve_insert_index, get_polyline_length } = await import(
    process.env.SINDREJS_TEST_BUILD ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts"
  );
  const points = [[0, 0, 0], [10, 0, 0], [20, 0, 0]];
  const samples = get_catmull_rom_points(points, 20);
  assert.equal(samples.length, 21);
  assert.deepEqual(samples[0], points[0]);
  assert.deepEqual(samples.at(-1), points.at(-1));
  assert.equal(get_curve_insert_index(5, 0, 3, samples, p => [p[0], p[1]]), 1);
  assert.equal(get_polyline_length(points), 20);
  assert.throws(() => get_catmull_rom_points(points, 0), RangeError);
});

test("camera frames an elongated model from the side", async () => {
  const { BoxGeometry, Mesh, PerspectiveCamera, Vector3 } = await import("three");
  const { set_camera_to_object } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts");
  const box = new Mesh(new BoxGeometry(1, 1, 10));
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(10, 0, 0);
  set_camera_to_object(camera, box);
  camera.updateMatrixWorld();
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-5, 5]) {
    const projected = new Vector3(x, y, z).project(camera);
    assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1);
  }
});

test("HTTP client can observe response errors without changing default throwing", async () => {
  const { AxiosError } = await import("axios");
  let observed;
  const client = get_http_client({
    baseURL: "https://example.org",
    adapter: async (config) => {
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, { data: { error: "expired" }, status: 401, statusText: "Unauthorized", headers: {}, config });
    },
    onError: (error) => { observed = error; },
  });
  await assert.rejects(() => client.get("session"), /HTTP 401/);
  assert.equal(observed?.status, 401);
});

test("HTTP error callback failures do not replace the original error", async () => {
  const { AxiosError } = await import("axios");
  const client = get_http_client({
    baseURL: "https://example.org",
    adapter: async (config) => { throw new AxiosError("Bad", "ERR_BAD_RESPONSE", config, undefined, { data: "bad", status: 500, statusText: "Bad", headers: {}, config }); },
    onError: () => { throw new Error("observer failed"); },
  });
  await assert.rejects(() => client.get("broken"), (error) => error instanceof HttpError && error.status === 500);
});

test("model loader rejects unsupported names before parser imports", async () => {
  const { load_model } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts");
  await assert.rejects(load_model(new ArrayBuffer(0), "model.xyz"), /supported model formats/);
});

test("model loader returns shared mesh statistics", async () => {
  const { load_model, dispose_object } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts");
  const ply = `ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n`;
  const loaded = await load_model(new TextEncoder().encode(ply).buffer, "triangle.ply");
  assert.equal(loaded.format, "ply");
  assert.equal(loaded.meshes, 1);
  assert.equal(loaded.vertices, 3);
  dispose_object(loaded.object);
});

test("surface path follows mesh edges and refreshes changed control points", async () => {
  const { get_path_cache, get_mesh_path_data, get_surface_path } = await import(
    process.env.SINDREJS_TEST_BUILD ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts"
  );
  const mesh = { faces: Uint32Array.of(0, 1, 2, 0xffffffff),
    verts: Float32Array.of(0, 0, 0, 2, 0, 0, 2, 2, 0), nbFaces: 1, nbVerts: 3 };
  const cache = get_path_cache();
  const data = get_mesh_path_data(cache, () => mesh);
  assert.deepEqual(data.adj[0].sort(), [1, 2]);
  const first = get_surface_path([[0, 0, 0], [2, 2, 0]], false, cache, () => mesh);
  assert.deepEqual(first, [[0, 0, 0], [2, 2, 0]]);
  assert.equal(get_surface_path([[0, 0, 0], [2, 2, 0]], false, cache, () => mesh), first);
  const shifted = get_surface_path([[0.0000001, 0, 0], [2, 2, 0]], false, cache, () => mesh);
  assert.notEqual(shifted, first);
  assert.equal(cache.cachedSegments.length, 1);
  assert.deepEqual(get_surface_path([[0, 0, 0]], false, cache, () => mesh), [[0, 0, 0]]);
  assert.equal(cache.cachedSegments.length, 0);
  assert.throws(() => get_mesh_path_data(get_path_cache(), () => ({ ...mesh, nbVerts: 4 })), RangeError);
});

test("mesh region follows one connected surface and pulling preserves faces", async () => {
  const { get_mesh_topology, get_mesh_region, change_mesh_by_brush } = await import(
    process.env.SINDREJS_TEST_BUILD ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts"
  );
  const mesh = { vertices: Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0.01, 1, 0, 0.01, 0, 1, 0.01),
  faces: Uint32Array.of(0, 1, 2, 3, 4, 5) };
  const topology = get_mesh_topology(mesh);
  const region = get_mesh_region(mesh, [0, 0, 0], 2, { seed_index: 0, topology });
  assert.deepEqual([...region.indices].sort(), [0, 1, 2]);
  const moved = change_mesh_by_brush(mesh, region, [0, 0, 2]);
  assert.equal(moved[2], 2);
  assert.equal(moved[11], mesh.vertices[11]);
  assert.equal(mesh.vertices[2], 0);
  assert.deepEqual(mesh.faces, Uint32Array.of(0, 1, 2, 3, 4, 5));
  const masked = get_mesh_region(mesh, [0, 0, 0], 2, { seed_index: 0, topology,
    mask: Float32Array.of(1, 0, 1, 1, 1, 1) });
  assert.deepEqual([...masked.indices].sort(), [0, 2]);
  assert.throws(() => get_mesh_region(mesh, [0, 0, 0], 2, { seed_index: 6 }), RangeError);
  assert.throws(() => get_mesh_topology({ ...mesh, faces: Uint32Array.of(0, 1, 6) }), RangeError);
});

test("smoothing and flattening edit only selected vertices with stable boundaries", async () => {
  const { get_mesh_topology, smooth_mesh_region, flatten_mesh_region } = await import(
    process.env.SINDREJS_TEST_BUILD ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts"
  );
  const mesh = { vertices: Float32Array.of(
    0,0,0, 1,0,0, 2,0,0, 0,1,0, 1,1,1, 2,1,0, 0,2,0, 1,2,0, 2,2,0),
    faces: Uint32Array.of(0,1,4, 0,4,3, 1,2,5, 1,5,4, 3,4,7, 3,7,6, 4,5,8, 4,8,7) };
  const topology = get_mesh_topology(mesh);
  const region = { indices: Uint32Array.of(0,4), weights: Float32Array.of(1,1) };
  assert.equal(topology.boundary[0], 1);
  assert.equal(topology.boundary[4], 0);
  const smooth = smooth_mesh_region(mesh, region, { topology, boundary: "fixed", strength: 0.5 });
  assert.equal(smooth[2], 0);
  assert.ok(smooth[14] < 1 && smooth[14] > 0);
  assert.equal(mesh.vertices[14], 1);
  const flat = flatten_mesh_region(mesh, region, { point: [0,0,0], normal: [0,0,2], strength: 1 });
  assert.equal(flat[14], 0);
  assert.equal(flat[17], 0);
  assert.throws(() => flatten_mesh_region(mesh, region, { point: [0,0,0], normal: [0,0,0] }), RangeError);
  assert.throws(() => smooth_mesh_region(mesh, region, { strength: 1.1 }), RangeError);
});

test("mesh topology reads mixed triangles and quads without adding a diagonal", async () => {
  const { get_mesh_topology, get_mesh_region } = await import(
    process.env.SINDREJS_TEST_BUILD ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts"
  );
  const mesh = { vertices: Float32Array.of(0,0,0, 1,0,0, 1,1,0, 0,1,0, 2,0,0),
    faces: Uint32Array.of(0,1,2,3, 1,4,2,0xffffffff), face_stride: 4 };
  const topology = get_mesh_topology(mesh);
  assert.deepEqual(topology.neighbors[0].sort(), [1,3]);
  assert.deepEqual(topology.neighbors[4].sort(), [1,2]);
  const region = get_mesh_region(mesh, [0,0,0], 1.1, { seed_index: 0, topology });
  assert.deepEqual([...region.indices].sort(), [0,1,3]);
  assert.throws(() => get_mesh_topology({ ...mesh, faces: Uint32Array.of(0,0,2,3) }), RangeError);
});

test("lazy module shares an import and retries after failure", async () => {
  let calls = 0;
  const get = lazy_module(async () => { calls++; if (calls === 1) throw Error("retry"); return { answer: 42 }; });
  await assert.rejects(get(), /retry/);
  assert.deepEqual(await Promise.all([get(), get()]), [{ answer: 42 }, { answer: 42 }]);
  assert.equal(calls, 2);
});

test("keyed loader shares filesets and retries a failed path", async () => {
  let calls = 0;
  const get = lazy_keyed(async (path) => { if (++calls === 1) throw Error("temporary"); return path.toUpperCase(); });
  await assert.rejects(get("wasm"), /temporary/);
  assert.deepEqual(await Promise.all([get("wasm"), get("wasm")]), ["WASM", "WASM"]);
  assert.equal(calls, 2);
});

test("ONNX runner shares release behavior across runtimes", async () => {
  const { createRunner } = await import(process.env.SINDREJS_TEST_BUILD
    ? "../dist/ai/onnx/runner.js" : "../src/ai/onnx/runner.ts");
  let releases = 0;
  const runner = createRunner({ inputNames: ["input"], outputNames: ["output"],
    async run(feeds) { return feeds; }, async release() { releases++; } });
  assert.deepEqual(await runner.run({ input: 1 }), { input: 1 });
  assert.deepEqual(runner.inputNames, ["input"]);
  await runner.release();
  await runner.release();
  assert.equal(releases, 1);
  assert.throws(() => runner.run({ input: 2 }), /released/);
});

test("Pino logger names components and redacts secrets in files", async () => {
  const { mkdtemp, readFile, readdir, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-logs-"));
  try {
    const parent = get_logger("host", { enabled: false });
    const component = get_logger("renderer", { parent });
    assert.equal(typeof component.warning, "function");
    const file = await get_file_logger("studio", { log_dir: dir, console_output: false });
    file.logger.success({ password: "secret" }, "ready");
    file.logger.error({ token: "secret" }, "failed");
    await file.close();
    const files = await readdir(dir);
    const logs = (await readFile(join(dir, files.find((name) => /^run\..*\.log$/.test(name))), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(logs.length, 2);
    assert.equal(logs[0].password, "[Redacted]");
    assert.equal(logs[0].level, 35);
    assert.equal(logs[1].token, "[Redacted]");
    assert.equal((await readFile(join(dir, files.find((name) => /^error\..*\.log$/.test(name))), "utf8")).trim().split("\n").length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("unified module loader and 3D formats", async () => {
  const { load_module } = await import(process.env.SINDREJS_TEST_BUILD ? "../dist/index.js" : "../src/index.ts");
  const threeD = await load_module("utils3d");
  assert.equal(typeof threeD.get_ply, "function");
  assert.equal((await load_module("ai")).get_node_onnx_runner instanceof Function, true);
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { BoxGeometry, Mesh } = await import("three");
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-mesh-"));
  try {
    const mesh = new Mesh(new BoxGeometry(1, 2, 3));
    await assert.rejects(() => save(mesh, join(dir, "shape.glb")), /sindrejs\/general\/3d/);
    for (const ext of ["ply", "stl", "obj", "glb", "gltf"]) {
      const file = join(dir, `shape.${ext}`);
      await save3d(mesh, file);
      const parsed = await load3d(file);
      assert.ok(ext === "ply" || ext === "stl" ? parsed.isBufferGeometry : ext === "obj" ? parsed.isObject3D : parsed.scene?.isObject3D, ext);
      assert.ok((await load(file, { as: "bytes" })).byteLength > 0, ext);
    }
    const onnx = join(dir, "sample.onnx");
    await save(Uint8Array.of(1, 2, 3), onnx);
    assert.deepEqual(await load(onnx, { as: "bytes" }), Uint8Array.of(1, 2, 3));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
