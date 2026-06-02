import { getAdminPasswordHash } from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/auditLog";
import { sha256 } from "@/lib/hash";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const resetModes = new Set(["votes", "candidates", "database"]);

async function resetVotes() {
  await prisma.encryptedVote.deleteMany();
}

async function resetCandidates() {
  await prisma.candidate.deleteMany();
}

async function resetDatabase() {
  await prisma.encryptedVote.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "action" TEXT NOT NULL,
      "details" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`DELETE FROM "AuditLog"`);
}

export async function POST(request: Request) {
  try {
    const { mode, password } = await request.json();
    const resetMode = String(mode ?? "");

    if (!resetModes.has(resetMode)) {
      return NextResponse.json({ error: "Invalid reset mode." }, { status: 400 });
    }

    if (sha256(String(password ?? "")) !== getAdminPasswordHash()) {
      await writeAuditLog("advanced_reset_password_failed", { mode: resetMode });
      return NextResponse.json(
        { error: "Incorrect admin password." },
        { status: 401 },
      );
    }

    if (resetMode === "votes") {
      await resetVotes();
    }

    if (resetMode === "candidates") {
      await resetCandidates();
    }

    if (resetMode === "database") {
      await resetDatabase();
    }

    await writeAuditLog("advanced_reset_completed", { mode: resetMode });

    return NextResponse.json({ ok: true, mode: resetMode });
  } catch (error) {
    console.error(error);
    await writeAuditLog("advanced_reset_failed");
    return NextResponse.json(
      { error: "Could not complete reset." },
      { status: 500 },
    );
  }
}
