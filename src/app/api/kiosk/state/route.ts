import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await prisma.kioskState.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        status: "LOCKED",
        active_class: null,
      },
    });

    const candidates = state.active_class
      ? await prisma.candidate.findMany({
          where: { class_name: state.active_class },
          orderBy: [{ gender: "asc" }, { name: "asc" }],
        })
      : [];

    return NextResponse.json({ state, candidates });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not fetch kiosk state." },
      { status: 500 },
    );
  }
}
