import { get_logger } from "sindrejs/general";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admin_json, require_admin } from "../../../lib/admin-auth";

export const runtime = "nodejs";
const logger = get_logger("official-site-admin-settings", { level: "info" });
const files = { runs: join(tmpdir(), "sindrejs-official-site-admin-runs.json"), articles: join(tmpdir(), "sindrejs-official-site-articles.json"), scenes: join(tmpdir(), "sindrejs-official-site-scenes.json") };

export async function GET() {
  const unauthorized = await require_admin(); if (unauthorized) return unauthorized;
  const persisted = await Promise.all(Object.entries(files).map(async ([name, path]) => ({ name, path, exists: await stat(path).then(() => true).catch(() => false) })));
  logger.info({ persisted: persisted.filter((item) => item.exists).length }, "admin settings requested");
  return admin_json({ environment: process.env.NODE_ENV ?? "development", auth: { passwordConfigured: Boolean(process.env.SINDREJS_ADMIN_PASSWORD), secretConfigured: Boolean(process.env.SINDREJS_ADMIN_SECRET) }, storage: { directory: tmpdir(), files: persisted } });
}
