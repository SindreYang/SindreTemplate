import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Group } from "three";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const built = !!process.env.SINDREJS_TEST_BUILD;
const { load, save } = await import(built ? "../dist/general/index.js" : "../src/general/index.ts");
const { set_camera_to_object, dispose_object } = await import(built ? "../dist/utils3d/index.js" : "../src/utils3d/index.ts");
const { AsyncStatus } = await import(built ? "../dist/utilsui/react.js" : "../src/utilsui/react.tsx");
const { ToastHost } = await import(built ? "../dist/utilsui/toast/index.js" : "../src/utilsui/toast/index.tsx");

test("unified local file API preserves JSON and text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-"));
  try {
    const path = join(dir, "one.json");
    await save({ value: "中文" }, path);
    assert.deepEqual(await load(path), { value: "中文" });
    await save("中文", join(dir, "nested", "a.md"));
    assert.equal(await load(join(dir, "nested", "a.md")), "中文");
    await assert.rejects(save(undefined, path), TypeError);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Bun uses the same general entry", async () => {
  if (!globalThis.Bun) return;
  const dir = await mkdtemp(join(tmpdir(), "sindrejs-bun-"));
  try {
    const path = join(dir, "one.json");
    await save({ value: 42 }, path);
    assert.deepEqual(await load(path), { value: 42 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Three.js camera fitting and owned resource disposal", () => {
  const mesh = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());
  const group = new Group(); group.add(mesh);
  const camera = new PerspectiveCamera(60, 1.5, .1, 1000);
  camera.position.set(0, 0, 15);
  const { center, distance } = set_camera_to_object(camera, group);
  assert.deepEqual(center.toArray(), [0, 0, 0]);
  assert.ok(distance > 3);
  let geometryDisposed = false, materialDisposed = false;
  mesh.geometry.addEventListener("dispose", () => { geometryDisposed = true; });
  mesh.material.addEventListener("dispose", () => { materialDisposed = true; });
  dispose_object(group);
  assert.equal(geometryDisposed && materialDisposed, true);
});

test("UI components render on server without browser globals", () => {
  const status = renderToStaticMarkup(createElement(AsyncStatus, { busy: true, children: "done" }));
  assert.match(status, /aria-busy="true"/);
  const markup = renderToStaticMarkup(createElement(ToastHost));
  assert.match(markup, /aria-live="polite"/);
});
