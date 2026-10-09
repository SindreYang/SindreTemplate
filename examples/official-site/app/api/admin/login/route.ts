import { create_fixed_window_limiter } from "sindrejs/general";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, admin_session_max_age, create_admin_session } from "../../../lib/admin-auth";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = create_fixed_window_limiter<string>({ max: MAX_FAILURES, window_ms: WINDOW_MS });

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: Request) {
  const key = clientKey(request);
  if (failures.check(key).limited) {
    return noStore(Response.json({ error: "登录失败次数过多，请 15 分钟后重试" }, { status: 429, headers: { "Retry-After": "900" } }));
  }
  const jsonRequest = request.headers.get("content-type")?.includes("application/json") ?? false;
  const body = jsonRequest
    ? await request.json().catch(() => null) as { username?: string; password?: string } | null
    : await request.formData().then((form) => ({ username: String(form.get("username") ?? ""), password: String(form.get("password") ?? "") })).catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const configuredPassword = process.env.SINDREJS_ADMIN_PASSWORD;
  const configuredSecret = process.env.SINDREJS_ADMIN_SECRET;
  if (process.env.NODE_ENV === "production" && (!configuredPassword || !configuredSecret)) {
    return noStore(jsonRequest ? Response.json({ error: "生产环境必须同时设置 SINDREJS_ADMIN_PASSWORD 和 SINDREJS_ADMIN_SECRET" }, { status: 503 }) : NextResponse.redirect(new URL("/admin/login?error=config", request.url), 303));
  }
  const expectedPassword = configuredPassword || "sindrejs-dev";
  if (username.length > 128 || password.length > 1024 || username !== "admin" || password !== expectedPassword) {
    failures.record(key);
    return noStore(jsonRequest ? Response.json({ error: "账号或密码不正确" }, { status: 401 }) : NextResponse.redirect(new URL("/admin/login?error=invalid", request.url), 303));
  }
  failures.reset(key);
  const response = jsonRequest ? NextResponse.json({ success: true }) : NextResponse.redirect(new URL("/admin", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(ADMIN_COOKIE, create_admin_session(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: admin_session_max_age,
  });
  return response;
}
