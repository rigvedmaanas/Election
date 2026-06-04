import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { countBallots, getCandidateVoteCount } from "@/lib/ballotCounts";
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

async function saveImage(image: File) {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const fileName = safeFileName(image.name);
  const filePath = path.join(uploadsDir, fileName);
  const buffer = Buffer.from(await image.arrayBuffer());

  await writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
}

async function candidateWithVotes(candidate: {
  id: number;
  name: string;
  class_name: string;
  gender: string;
  image_path: string;
}) {
  const votes = await prisma.encryptedVote.findMany({
    orderBy: { id: "asc" },
  });
  const ballotCounts = countBallots(votes);

  return {
    ...candidate,
    votes: getCandidateVoteCount(ballotCounts, candidate),
  };
}

export async function GET() {
  try {
    const [candidates, votes] = await Promise.all([
      prisma.candidate.findMany({
        orderBy: [{ class_name: "asc" }, { gender: "asc" }, { name: "asc" }],
      }),
      prisma.encryptedVote.findMany({
        orderBy: { id: "asc" },
      }),
    ]);
    const ballotCounts = countBallots(votes);

    return NextResponse.json({
      candidates: candidates.map((candidate) => ({
        ...candidate,
        votes: getCandidateVoteCount(ballotCounts, candidate),
      })),
    });
  } catch (error) {
    console.error(error);
    await writeAuditLog("candidate_list_failed");
    return NextResponse.json(
      { error: "Could not load candidates." },
      { status: 500 },
    );
  }
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

    const candidate = await prisma.candidate.create({
      data: {
        name,
        class_name: className,
        gender,
        image_path: await saveImage(image),
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

export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") ?? "").trim();
    const className = String(formData.get("class_name") ?? "").trim();
    const gender = String(formData.get("gender") ?? "").trim();
    const image = formData.get("image");

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A valid candidate id is required." }, { status: 400 });
    }

    if (!name || !className || !allowedGenders.has(gender)) {
      return NextResponse.json(
        { error: "Name, class, and a valid gender are required." },
        { status: 400 },
      );
    }

    const existing = await prisma.candidate.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const current = await candidateWithVotes(existing);
    const identityChanged =
      existing.name !== name ||
      existing.class_name !== className ||
      existing.gender !== gender;

    if (current.votes > 0 && identityChanged) {
      return NextResponse.json(
        { error: "Only the image can be edited after a candidate has votes." },
        { status: 409 },
      );
    }

    const imagePath =
      image instanceof File && image.size > 0 ? await saveImage(image) : existing.image_path;

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        name,
        class_name: className,
        gender,
        image_path: imagePath,
      },
    });

    const updated = await candidateWithVotes(candidate);

    await writeAuditLog("candidate_updated", {
      candidate_id: candidate.id,
      name: candidate.name,
      class_name: candidate.class_name,
      gender: candidate.gender,
    });

    return NextResponse.json({ candidate: updated });
  } catch (error) {
    console.error(error);
    await writeAuditLog("candidate_update_failed");
    return NextResponse.json(
      { error: "Could not update candidate." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A valid candidate id is required." }, { status: 400 });
    }

    const existing = await prisma.candidate.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const current = await candidateWithVotes(existing);

    if (current.votes > 0) {
      return NextResponse.json(
        { error: "Candidates can only be removed when their vote count is zero." },
        { status: 409 },
      );
    }

    await prisma.candidate.delete({ where: { id } });

    await writeAuditLog("candidate_deleted", {
      candidate_id: existing.id,
      name: existing.name,
      class_name: existing.class_name,
      gender: existing.gender,
    });

    return NextResponse.json({ ok: true, candidate: current });
  } catch (error) {
    console.error(error);
    await writeAuditLog("candidate_delete_failed");
    return NextResponse.json(
      { error: "Could not remove candidate." },
      { status: 500 },
    );
  }
}
