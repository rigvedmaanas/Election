import { adminCookieName, resultCookieName } from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/auditLog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  response.cookies.set(resultCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });

  await writeAuditLog("admin_logout");

  return response;
}
