import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CandidateResult = {
  name: string;
  class_name: string;
  gender: string;
  votes: number;
};

type ClassResult = {
  class_name: string;
  total_votes: number;
  male: CandidateResult[];
  female: CandidateResult[];
};

function getEncryptionKey() {
  const secret = process.env.VOTE_ENCRYPTION_SECRET ?? "";

  if (secret.length !== 32) {
    throw new Error("VOTE_ENCRYPTION_SECRET must be exactly 32 characters.");
  }

  return Buffer.from(secret, "utf8");
}

function decryptBallot(encryptedBallot: string) {
  const [ivHex, ciphertextHex, authTagHex] = encryptedBallot
    .split(":")
    .map((part) => part.trim());

  if (!ivHex || !ciphertextHex || !authTagHex) {
    throw new Error("Invalid encrypted ballot format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function GET() {
  try {
    const [votes, candidates] = await Promise.all([
      prisma.encryptedVote.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.candidate.findMany({
        orderBy: [{ class_name: "asc" }, { gender: "asc" }, { name: "asc" }],
      }),
    ]);

    const maleCounts = new Map<string, number>();
    const femaleCounts = new Map<string, number>();
    const classTotals = new Map<string, number>();
    let invalidBallots = 0;

    for (const vote of votes) {
      try {
        const plaintext = decryptBallot(vote.encrypted_ballot_string);
        const [maleName, femaleName] = plaintext
          .split("|")
          .map((part) => part.trim());

        if (!maleName || !femaleName) {
          invalidBallots += 1;
          continue;
        }

        increment(classTotals, vote.class_name);
        increment(maleCounts, `${vote.class_name}|${maleName}`);
        increment(femaleCounts, `${vote.class_name}|${femaleName}`);
      } catch {
        invalidBallots += 1;
      }
    }

    const classes = new Map<string, ClassResult>();

    for (const candidate of candidates) {
      const current = classes.get(candidate.class_name) ?? {
        class_name: candidate.class_name,
        total_votes: classTotals.get(candidate.class_name) ?? 0,
        male: [],
        female: [],
      };

      const result = {
        name: candidate.name,
        class_name: candidate.class_name,
        gender: candidate.gender,
        votes:
          candidate.gender === "Male"
            ? maleCounts.get(`${candidate.class_name}|${candidate.name}`) ?? 0
            : femaleCounts.get(`${candidate.class_name}|${candidate.name}`) ?? 0,
      };

      if (candidate.gender === "Male") {
        current.male.push(result);
      } else {
        current.female.push(result);
      }

      classes.set(candidate.class_name, current);
    }

    for (const [className, totalVotes] of classTotals) {
      if (!classes.has(className)) {
        classes.set(className, {
          class_name: className,
          total_votes: totalVotes,
          male: [],
          female: [],
        });
      }
    }

    const results = Array.from(classes.values()).map((classResult) => ({
      ...classResult,
      male: classResult.male.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name)),
      female: classResult.female.sort(
        (a, b) => b.votes - a.votes || a.name.localeCompare(b.name),
      ),
    }));

    await writeAuditLog("results_viewed", {
      total_votes: votes.length,
      valid_votes: votes.length - invalidBallots,
      invalid_ballots: invalidBallots,
    });

    return NextResponse.json({
      total_votes: votes.length,
      valid_votes: votes.length - invalidBallots,
      invalid_ballots: invalidBallots,
      results,
    });
  } catch (error) {
    console.error(error);
    await writeAuditLog("results_view_failed");
    return NextResponse.json(
      { error: "Could not calculate results." },
      { status: 500 },
    );
  }
}
