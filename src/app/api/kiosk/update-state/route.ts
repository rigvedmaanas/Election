import { prisma } from "@/lib/prisma";
import { isAdminRequest, unauthorizedResponse } from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/auditLog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const statuses = new Set(["LOCKED", "UNLOCKED"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const status = String(body.status ?? "").trim();
    const activeClass =
      status === "UNLOCKED" ? String(body.active_class ?? "").trim() : null;

    if (!statuses.has(status)) {
      return NextResponse.json({ error: "Invalid kiosk status." }, { status: 400 });
    }

    if (status === "UNLOCKED" && !activeClass) {
      return NextResponse.json(
        { error: "A class must be selected before unlocking." },
        { status: 400 },
      );
    }

    if (status === "UNLOCKED" && !isAdminRequest(request)) {
      await writeAuditLog("kiosk_unlock_blocked", { active_class: activeClass });
      return unauthorizedResponse();
    }

    const state = await prisma.kioskState.upsert({
      where: { id: 1 },
      update: {
        status,
        active_class: activeClass,
      },
      create: {
        id: 1,
        status,
        active_class: activeClass,
      },
    });

    await writeAuditLog(status === "UNLOCKED" ? "kiosk_unlocked" : "kiosk_locked", {
      active_class: state.active_class,
    });

    return NextResponse.json({ state });
  } catch (error) {
    console.error(error);
    await writeAuditLog("kiosk_state_update_failed");
    return NextResponse.json(
      { error: "Could not update kiosk state." },
      { status: 500 },
    );
  }
}
