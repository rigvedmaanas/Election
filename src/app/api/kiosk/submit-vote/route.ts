import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { schoolClasses } from "@/lib/classes";
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
    const { ballot, class_name: classNameValue } = await request.json();
    const plaintext = String(ballot ?? "").trim();
    const className = String(classNameValue ?? "").trim();

    if (!schoolClasses.includes(className)) {
      await writeAuditLog("vote_rejected_invalid_class", { class_name: className });
      return NextResponse.json({ error: "Invalid class." }, { status: 400 });
    }

    if (!/^[^|]+\|[^|]+$/.test(plaintext)) {
      await writeAuditLog("vote_rejected_invalid_format", { class_name: className });
      return NextResponse.json(
        { error: "Ballot must be formatted as MaleName|FemaleName." },
        { status: 400 },
      );
    }

    const encryptedBallot = encryptBallot(plaintext);
    const result = await prisma.encryptedVote.create({
      data: {
        class_name: className,
        encrypted_ballot_string: encryptedBallot,
      },
    });

    await writeAuditLog("vote_submitted", {
      vote_id: result.id,
      class_name: result.class_name,
    });

    return NextResponse.json({ ok: true, vote_id: result.id });
  } catch (error) {
    console.error(error);
    await writeAuditLog("vote_submit_failed");
    return NextResponse.json(
      { error: "Could not submit vote." },
      { status: 500 },
    );
  }
}
