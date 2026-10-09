import { get_logger } from "sindrejs/general";
import { admin_json, require_admin } from "../../../lib/admin-auth";

export const runtime = "nodejs";

const logger = get_logger("official-site-admin", { level: "info" });

type ModuleProbe = { name: string; entry: string; specifier: string; runtime: string; usage: string };
type ModuleInfo = Omit<ModuleProbe, "specifier"> & { status: "ready" | "optional"; detail?: string; install?: string };
const moduleProbes: ModuleProbe[] = [
  { name: "general", entry: "sindrejs/general", specifier: "sindrejs/general", runtime: "Web / Node / Bun", usage: "HTTP、JSON、日志、文件" },
  { name: "utils2d", entry: "sindrejs/utils2d", specifier: "sindrejs/utils2d", runtime: "Browser", usage: "Canvas 标注" },
  { name: "utils3d", entry: "sindrejs/utils3d", specifier: "sindrejs/utils3d", runtime: "Browser / Node", usage: "模型、路径、网格" },
  { name: "utilsui", entry: "sindrejs/utilsui/panel", specifier: "sindrejs/utilsui/panel", runtime: "React", usage: "后台交互组件" },
  { name: "ai", entry: "sindrejs/ai", specifier: "sindrejs/ai", runtime: "Browser / Node", usage: "按需加载路由" },
  { name: "ai-onnx-web", entry: "sindrejs/ai/onnx/web", specifier: "sindrejs/ai/onnx/web", runtime: "Browser", usage: "ONNX Web" },
  { name: "ai-mediapipe", entry: "sindrejs/ai/mediapipe", specifier: "sindrejs/ai/mediapipe", runtime: "Browser", usage: "MediaPipe Vision" },
  { name: "ai-tfjs", entry: "sindrejs/ai/tfjs", specifier: "sindrejs/ai/tfjs", runtime: "Browser", usage: "TensorFlow.js" },
  { name: "utilsagent", entry: "sindrejs/utilsagent/sse", specifier: "sindrejs/utilsagent/sse", runtime: "Node / Edge", usage: "SSE 传输" },
  { name: "utilsagent-agent", entry: "sindrejs/utilsagent", specifier: "sindrejs/utilsagent", runtime: "Node", usage: "LangChain Agent" },
];
const adminApiRoutes = ["login", "logout", "overview", "runs", "articles", "scenes", "settings"] as const;

const runtimeImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
const installCommands: Record<string, string> = {
  "sindrejs/ai/mediapipe": "bun add @mediapipe/tasks-vision",
  "sindrejs/ai/tfjs": "bun add @tensorflow/tfjs",
  "sindrejs/utilsagent": "bun add langchain @langchain/core @langchain/openai zod",
};

async function probeModule({ specifier, ...module }: ModuleProbe): Promise<ModuleInfo> {
  try {
    await runtimeImport(specifier);
    return { ...module, status: "ready" };
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 140) : "模块依赖未安装";
    return { ...module, status: "optional", detail, install: installCommands[module.entry] };
  }
}

export async function GET() {
  const unauthorized = await require_admin();
  if (unauthorized) return unauthorized;
  const modules = await Promise.all(moduleProbes.map(probeModule));
  const ready = modules.filter((module) => module.status === "ready").length;
  logger.info({ modules: modules.length, ready }, "admin overview requested");
  return admin_json({
    metrics: { modules: modules.length, routes: adminApiRoutes.length, queued: 0, successRate: modules.length ? Math.round((ready / modules.length) * 100) : 0 },
    modules,
    generatedAt: new Date().toISOString(),
  });
}
