import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getEncryptionKey() {
  const secret = process.env.VOTE_ENCRYPTION_SECRET ?? "";

  if (secret.length !== 32) {
    throw new Error("VOTE_ENCRYPTION_SECRET must be exactly 32 characters.");
  }

  return Buffer.from(secret, "utf8");
}

function encryptBallot(plaintext: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")} : ${ciphertext.toString("hex")} : ${authTag.toString("hex")}`;
}

export async function POST(request: Request) {
  try {
    const { ballot } = await request.json();
    const plaintext = String(ballot ?? "").trim();

    if (!/^[^|]+\|[^|]+$/.test(plaintext)) {
      await writeAuditLog("vote_rejected_invalid_format");
      return NextResponse.json(
        { error: "Ballot must be formatted as MaleName|FemaleName." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.kioskState.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          status: "LOCKED",
          active_class: null,
        },
      });

      if (state.status !== "UNLOCKED" || !state.active_class) {
        throw new Error("KIOSK_LOCKED");
      }

      const encryptedBallot = encryptBallot(plaintext);

      const vote = await tx.encryptedVote.create({
        data: {
          class_name: state.active_class,
          encrypted_ballot_string: encryptedBallot,
        },
      });

      await tx.kioskState.update({
        where: { id: 1 },
        data: {
          status: "LOCKED",
          active_class: null,
        },
      });

      return vote;
    });

    await writeAuditLog("vote_submitted", { vote_id: result.id });

    return NextResponse.json({ ok: true, vote_id: result.id });
  } catch (error) {
    if (error instanceof Error && error.message === "KIOSK_LOCKED") {
      await writeAuditLog("vote_rejected_kiosk_locked");
      return NextResponse.json({ error: "Kiosk is locked." }, { status: 423 });
    }

    console.error(error);
    await writeAuditLog("vote_submit_failed");
    return NextResponse.json(
      { error: "Could not submit vote." },
      { status: 500 },
    );
  }
}
