import { NextResponse } from "next/server";

export const adminCookieName = "school-election-admin";
export const resultCookieName = "school-election-results";

export function getAdminPasswordHash() {
  return (
    process.env.ADMIN_PASSWORD_SHA256 ??
    "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
  );
}

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "change-this-admin-session-secret";
}

export function getResultKeyOneHash() {
  return (
    process.env.RESULT_KEY_ONE_SHA256 ??
    "4fb3aedc45fd39c68fd2c3e37b82242d2dcd4f2c75cc816c11636dac9fa753fe"
  );
}

export function getResultKeyTwoHash() {
  return (
    process.env.RESULT_KEY_TWO_SHA256 ??
    "167f5cb417ca80c88d62da6ebced3fc2844a8e19fd9731b072d0723f81a0a0c9"
  );
}

export function getResultSessionSecret() {
  return process.env.RESULT_SESSION_SECRET ?? "change-this-result-session-secret";
}

export function isAdminRequest(request: Request) {
  return hasCookieValue(request, adminCookieName, getAdminSessionSecret());
}

export function isResultUnlockedRequest(request: Request) {
  return hasCookieValue(request, resultCookieName, getResultSessionSecret());
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

export function resultUnlockRequiredResponse() {
  return NextResponse.json(
    { error: "Two-key results unlock required." },
    { status: 403 },
  );
}
