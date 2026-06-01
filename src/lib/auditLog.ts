import { prisma } from "@/lib/prisma";

let tableReady = false;

async function ensureAuditLogTable() {
  if (tableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "action" TEXT NOT NULL,
      "details" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  tableReady = true;
}

export async function writeAuditLog(
  action: string,
  details?: Record<string, unknown>,
) {
  try {
    await ensureAuditLogTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AuditLog" ("action", "details") VALUES (?, ?)`,
      action,
      details ? JSON.stringify(details) : null,
    );
  } catch (error) {
    console.error("Could not write audit log.", error);
  }
}

export async function readAuditLogs(limit = 100) {
  await ensureAuditLogTable();

  return prisma.$queryRawUnsafe<
    Array<{
      id: number;
      action: string;
      details: string | null;
      created_at: string;
    }>
  >(
    `SELECT "id", "action", "details", "created_at"
     FROM "AuditLog"
     ORDER BY "id" DESC
     LIMIT ?`,
    limit,
  );
}
