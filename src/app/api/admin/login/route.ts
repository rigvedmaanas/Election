import {
  adminCookieName,
  getAdminPasswordHash,
  getAdminSessionSecret,
} from "@/lib/adminAuth";
import { sha256 } from "@/lib/hash";
import { writeAuditLog } from "@/lib/auditLog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (sha256(String(password ?? "")) !== getAdminPasswordHash()) {
    await writeAuditLog("admin_login_failed");
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, getAdminSessionSecret(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  await writeAuditLog("admin_login_success");

  return response;
}
