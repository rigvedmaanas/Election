import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { countBallots, getCandidateVoteCount } from "@/lib/ballotCounts";
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

    const ballotCounts = countBallots(votes);
    const { classTotals, invalidBallots } = ballotCounts;

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
        votes: getCandidateVoteCount(ballotCounts, candidate),
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
