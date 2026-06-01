import { readAuditLogs, writeAuditLog } from "@/lib/auditLog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const logs = await readAuditLogs(150);
    await writeAuditLog("audit_logs_viewed", { count: logs.length });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not read audit logs." },
      { status: 500 },
    );
  }
}
