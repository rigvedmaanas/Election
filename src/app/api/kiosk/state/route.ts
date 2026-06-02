import { prisma } from "@/lib/prisma";
import { schoolClasses } from "@/lib/classes";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const className = String(searchParams.get("class_name") ?? "").trim();

    if (!schoolClasses.includes(className)) {
      return NextResponse.json({ error: "Invalid class." }, { status: 400 });
    }

    const candidates = await prisma.candidate.findMany({
      where: { class_name: className },
      orderBy: [{ gender: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ class_name: className, candidates });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not fetch kiosk state." },
      { status: 500 },
    );
  }
}
