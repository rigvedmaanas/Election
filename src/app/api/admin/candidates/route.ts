import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";

const allowedGenders = new Set(["Male", "Female"]);

function safeFileName(name: string) {
  const extension = path.extname(name).toLowerCase();
  const base = path
    .basename(name, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `${Date.now()}-${base || "candidate"}${extension || ".jpg"}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const className = String(formData.get("class_name") ?? "").trim();
    const gender = String(formData.get("gender") ?? "").trim();
    const image = formData.get("image");

    if (!name || !className || !allowedGenders.has(gender)) {
      return NextResponse.json(
        { error: "Name, class, and a valid gender are required." },
        { status: 400 },
      );
    }

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json(
        { error: "A candidate image is required." },
        { status: 400 },
      );
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const fileName = safeFileName(image.name);
    const filePath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await image.arrayBuffer());

    await writeFile(filePath, buffer);

    const candidate = await prisma.candidate.create({
      data: {
        name,
        class_name: className,
        gender,
        image_path: `/uploads/${fileName}`,
      },
    });

    await writeAuditLog("candidate_created", {
      candidate_id: candidate.id,
      name: candidate.name,
      class_name: candidate.class_name,
      gender: candidate.gender,
    });

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    console.error(error);
    await writeAuditLog("candidate_create_failed");
    return NextResponse.json(
      { error: "Could not create candidate." },
      { status: 500 },
    );
  }
}
