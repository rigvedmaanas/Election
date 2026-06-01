import { NextResponse } from "next/server";

export const adminCookieName = "school-election-admin";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "change-this-admin-session-secret";
}

export function isAdminRequest(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminCookieName}=`));

  if (!cookie) return false;

  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));

  return value === getAdminSessionSecret();
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Admin login required." }, { status: 401 });
}
