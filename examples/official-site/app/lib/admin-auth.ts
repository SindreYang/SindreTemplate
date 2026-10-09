import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sindrejs_admin";
const SESSION_MAX_AGE = 60 * 60 * 8;

function secret() {
  return process.env.SINDREJS_ADMIN_SECRET || process.env.SINDREJS_ADMIN_PASSWORD || "sindrejs-local-admin-secret";
}

function signature(timestamp: string) {
  return createHmac("sha256", secret()).update(timestamp).digest("hex");
}

export function create_admin_session() {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return `${timestamp}.${signature(timestamp)}`;
}

export function is_admin_session(value: string | undefined) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [timestamp, digest] = parts;
  const issuedAt = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!timestamp || !digest || !Number.isSafeInteger(issuedAt)) return false;
  if (now - issuedAt > SESSION_MAX_AGE || issuedAt > now + 60) return false;
  const expected = signature(timestamp);
  if (digest.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
}

export async function is_admin_request() {
  const store = await cookies();
  return is_admin_session(store.get(ADMIN_COOKIE)?.value);
}

export async function require_admin() {
  if (await is_admin_request()) return null;
  return Response.json({ error: "需要先登录后台" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export function admin_json<T>(data: T, init?: ResponseInit) {
  const response = Response.json(data, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const admin_session_max_age = SESSION_MAX_AGE;
