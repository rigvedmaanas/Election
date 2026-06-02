import { NextResponse } from "next/server";

export const adminCookieName = "school-election-admin";

export function getAdminPasswordHash() {
  return (
    process.env.ADMIN_PASSWORD_SHA256 ??
    "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
  );
}

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "change-this-admin-session-secret";
}

export function isAdminRequest(request: Request) {
  return hasCookieValue(request, adminCookieName, getAdminSessionSecret());
}

function hasCookieValue(request: Request, name: string, expectedValue: string) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return false;

  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));

  return value === expectedValue;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Admin login required." }, { status: 401 });
}
