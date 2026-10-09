import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
