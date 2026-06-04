import crypto from "crypto";

type EncryptedVoteRow = {
  class_name: string;
  encrypted_ballot_string: string;
};

export type BallotCountSummary = {
  maleCounts: Map<string, number>;
  femaleCounts: Map<string, number>;
  classTotals: Map<string, number>;
  invalidBallots: number;
};

export function candidateVoteKey(className: string, name: string) {
  return `${className}|${name}`;
}

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

export function countBallots(votes: EncryptedVoteRow[]): BallotCountSummary {
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
      increment(maleCounts, candidateVoteKey(vote.class_name, maleName));
      increment(femaleCounts, candidateVoteKey(vote.class_name, femaleName));
    } catch {
      invalidBallots += 1;
    }
  }

  return { maleCounts, femaleCounts, classTotals, invalidBallots };
}

export function getCandidateVoteCount(
  summary: Pick<BallotCountSummary, "maleCounts" | "femaleCounts">,
  candidate: { class_name: string; gender: string; name: string },
) {
  const counts = candidate.gender === "Male" ? summary.maleCounts : summary.femaleCounts;

  return counts.get(candidateVoteKey(candidate.class_name, candidate.name)) ?? 0;
}
