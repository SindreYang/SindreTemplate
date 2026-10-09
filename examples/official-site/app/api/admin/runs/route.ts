import { create_versioned_store, load, save, get_logger, safe_parse_json } from "sindrejs/general";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admin_json, require_admin } from "../../../lib/admin-auth";

export const runtime = "nodejs";

type Run = { id: string; action: string; status: "success" | "failed"; duration: number; createdAt: string; detail: string };
const logger = get_logger("official-site-admin-runs", { level: "info" });
const seedRuns: Run[] = [
  { id: "run-001", action: "JSON inspect", status: "success", duration: 42, createdAt: new Date(Date.now() - 240_000).toISOString(), detail: "general / safe_parse_json" },
  { id: "run-002", action: "Module health", status: "success", duration: 86, createdAt: new Date(Date.now() - 540_000).toISOString(), detail: "6 modules checked" },
  { id: "run-003", action: "JSON inspect", status: "success", duration: 31, createdAt: new Date(Date.now() - 900_000).toISOString(), detail: "general / get_http_client" },
];
const storePath = join(tmpdir(), "sindrejs-official-site-admin-runs.json");
let runsPromise: Promise<Run[]> | undefined;
let version = 0;

async function getRuns(): Promise<Run[]> {
  return runsPromise ??= load<Run[]>(storePath).catch(async () => {
    await save(seedRuns, storePath);
    return seedRuns.map((run) => ({ ...run }));
  });
}

const runsStore = create_versioned_store<Run[], number>({
  read: async () => ({ value: await getRuns(), version }),
  write: async (value) => { const next = value.map((run) => ({ ...run })); await save(next, storePath); version++; runsPromise = Promise.resolve(next); return { value: next, version }; },
});

export async function GET(request: Request) {
  const unauthorized = await require_admin();
  if (unauthorized) return unauthorized;
  const { value: runs } = await runsStore.read();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(20, Math.max(1, Number(url.searchParams.get("pageSize") ?? 8)));
  const start = (page - 1) * pageSize;
  return admin_json({ items: runs.slice(start, start + pageSize), total: runs.length, hasMore: start + pageSize < runs.length });
}

export async function POST(request: Request) {
  const unauthorized = await require_admin();
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null) as { source?: unknown } | null;
  if (!body || typeof body.source !== "string") return admin_json({ success: false, error: "source 必须是字符串。" }, { status: 400 });
  const source = body.source;
  const result = safe_parse_json(source);
  let saved: Awaited<ReturnType<typeof runsStore.update>>;
  do {
    const current = await runsStore.read();
    saved = await runsStore.update(current.version, (runs) => [{
      id: `run-${String(runs.length + 1).padStart(3, "0")}`,
      action: "JSON inspect",
      status: result.success ? "success" : "failed",
      duration: Math.max(12, Math.round(source.length * 0.8)),
      createdAt: new Date().toISOString(),
      detail: result.success ? "general / safe_parse_json" : result.error.message,
    }, ...runs]);
  } while (!saved.ok);
  const run = saved.value[0]!;
  logger.info({ id: run.id, status: run.status }, "admin run created");
  return admin_json({ success: result.success, run, data: result.success ? result.value : undefined, error: result.success ? undefined : result.error.message }, { status: result.success ? 200 : 422 });
}
