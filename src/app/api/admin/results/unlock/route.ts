import {
  getResultKeyOneHash,
  getResultKeyTwoHash,
  getResultSessionSecret,
  resultCookieName,
} from "@/lib/adminAuth";
import { sha256 } from "@/lib/hash";
import { writeAuditLog } from "@/lib/auditLog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { keyOne, keyTwo } = await request.json();
  const firstKeyMatches = sha256(String(keyOne ?? "")) === getResultKeyOneHash();
  const secondKeyMatches = sha256(String(keyTwo ?? "")) === getResultKeyTwoHash();

  if (!firstKeyMatches || !secondKeyMatches) {
    await writeAuditLog("results_unlock_failed", {
      first_key_valid: firstKeyMatches,
      second_key_valid: secondKeyMatches,
    });

    return NextResponse.json(
      { error: "Both result keys are required." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(resultCookieName, getResultSessionSecret(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  await writeAuditLog("results_unlock_success");

  return response;
}
