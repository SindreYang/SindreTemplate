"use client";

import { get_http_client, HttpError } from "sindrejs/general";

export const admin_api = get_http_client({
  baseURL: "/",
  timeout: 8000,
  onError: (error) => {
    if (error.status === 401 && typeof window !== "undefined") window.location.assign("/admin/login?error=expired");
  },
});

export function admin_error_message(error: unknown, action: string) {
  if (!(error instanceof HttpError)) return `${action}失败`;
  try {
    const body = JSON.parse(error.body) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return `${action}失败：${body.error}`;
  } catch {
    // Use the status for non-JSON responses.
  }
  return `${action}失败：HTTP ${error.status}`;
}
