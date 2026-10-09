import { create_versioned_store, load, save } from "sindrejs/general";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admin_json, require_admin } from "../../../lib/admin-auth";
import { is_missing_file } from "../../../lib/storage-errors";

export const runtime = "nodejs";
export type ScenePoint = [number, number, number];
export type Scene = { id: string; name: string; points: ScenePoint[]; updatedAt: string };
const storePath = join(tmpdir(), "sindrejs-official-site-scenes.json");
const seed: Scene = { id: "scene-main", name: "主路径演示", points: [[-1.8, 0, -1], [-.7, .8, 0], [.4, -.2, 1], [1.8, .7, .2]], updatedAt: new Date().toISOString() };

async function getScene() {
  try {
    const scene = await load<Scene>(storePath);
    if (!scene || typeof scene !== "object") throw new TypeError("3D 场景存储格式无效");
    return scene;
  } catch (error) {
    if (!is_missing_file(error)) throw error;
    await save(seed, storePath);
    return { ...seed, points: seed.points.map((point) => [...point] as ScenePoint) };
  }
}
function validPoint(value: unknown): value is ScenePoint { return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number" && Number.isFinite(item)); }
const MAX_COORDINATE = 1_000_000;
const sceneStore = create_versioned_store<Scene, string>({
  read: async () => { const value = await getScene(); return { value, version: value.updatedAt }; },
  write: async (value) => { await save(value, storePath); return { value, version: value.updatedAt }; },
});

export async function GET() {
  const unauthorized = await require_admin(); if (unauthorized) return unauthorized;
  return admin_json({ scene: (await sceneStore.read()).value });
}

export async function POST(request: Request) {
  const unauthorized = await require_admin(); if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null) as Partial<Scene> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const points = Array.isArray(body?.points) ? body.points : [];
  if (!name || name.length > 100 || points.length < 2 || points.length > 32 || !points.every(validPoint) || points.some((point) => point.some((coordinate) => Math.abs(coordinate) > MAX_COORDINATE))) return admin_json({ error: "场景名称（最多 100 字）和范围在 ±1000000 内的 2 到 32 个三维控制点是必需的" }, { status: 422 });
  const id = typeof body?.id === "string" ? body.id : undefined;
  const updatedAt = typeof body?.updatedAt === "string" ? body.updatedAt : undefined;
  const expectedVersion = updatedAt ?? (await sceneStore.read()).version;
  const saved = await sceneStore.update(expectedVersion, (current) => ({
    id: id || current.id,
    name,
    points: points as ScenePoint[],
    updatedAt: new Date().toISOString(),
  }));
  if (!saved.ok) return admin_json({ error: "3D 场景已被其他页面更新，请重新加载最新版本" }, { status: 409 });
  return admin_json({ success: true, scene: saved.value });
}
