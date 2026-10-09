import { get_logger, safe_parse_json } from "sindrejs/general";

export const runtime = "nodejs";

const logger = get_logger("official-site-api", { level: "info" });
const MAX_INPUT = 20_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "请求体必须是 JSON。" },
      { status: 400 },
    );
  }

  const source =
    typeof body === "object" && body !== null && "source" in body
      ? (body as { source: unknown }).source
      : undefined;
  if (
    typeof source !== "string" ||
    !source.trim() ||
    source.length > MAX_INPUT
  ) {
    return Response.json(
      { success: false, error: `请输入 1 到 ${MAX_INPUT} 个字符的 JSON。` },
      { status: 400 },
    );
  }

  const parsed = safe_parse_json(source);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.message },
      { status: 422 },
    );
  }

  const value = parsed.value;
  const kind = Array.isArray(value)
    ? "array"
    : value === null
      ? "null"
      : typeof value;
  const entries =
    value !== null && typeof value === "object" ? Object.keys(value).length : 0;
  logger.info({ kind, entries }, "JSON inspected");
  return Response.json({
    success: true,
    data: value,
    meta: { kind, entries, bytes: new TextEncoder().encode(source).byteLength },
  });
}
