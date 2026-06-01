"use client";

import { Button, Card, Link } from "@heroui/react";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { HeroSelect } from "@/components/HeroSelect";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

type ResultsPayload = {
  total_votes: number;
  valid_votes: number;
  invalid_ballots: number;
  results: ClassResult[];
};

function CandidateTable({
  title,
  candidates,
}: {
  title: string;
  candidates: CandidateResult[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#ddd6c8] bg-white">
      <div className="border-b border-[#ddd6c8] bg-[#f3efe6] px-4 py-3">
        <h3 className="font-semibold text-[#171717]">{title}</h3>
      </div>
      <div className="divide-y divide-[#eee8dc]">
        {candidates.length ? (
          candidates.map((candidate, index) => (
            <div
              key={`${candidate.class_name}-${candidate.gender}-${candidate.name}`}
              className="grid grid-cols-[48px_1fr_88px] items-center gap-3 px-4 py-3"
            >
              <span className="text-sm font-semibold text-[#706b61]">
                #{index + 1}
              </span>
              <span className="font-medium text-[#171717]">{candidate.name}</span>
              <span className="rounded-md bg-[#1f3f3a] px-3 py-1 text-center text-sm font-semibold text-white">
                {candidate.votes}
              </span>
            </div>
          ))
        ) : (
          <p className="px-4 py-4 text-sm text-[#706b61]">No candidates found.</p>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [payload, setPayload] = useState<ResultsPayload | null>(null);
  const [selectedClass, setSelectedClass] = useState("All Classes");
  const [keyOne, setKeyOne] = useState("");
  const [keyTwo, setKeyTwo] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [needsResultsUnlock, setNeedsResultsUnlock] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  async function loadResults() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/results", { cache: "no-store" });
      const data = await response.json();

      if (response.status === 403) {
        setNeedsResultsUnlock(true);
        setPayload(null);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load results.");
      }

      setPayload(data);
      setNeedsResultsUnlock(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load results.");
    } finally {
      setIsLoading(false);
    }
  }

  async function unlockResults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUnlocking(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/results/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyOne, keyTwo }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not unlock results.");
      }

      setKeyOne("");
      setKeyTwo("");
      setNeedsResultsUnlock(false);
      await loadResults();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not unlock results.",
      );
    } finally {
      setIsUnlocking(false);
    }
  }

  useEffect(() => {
    void loadResults();
  }, []);

  const classOptions = useMemo(
    () => ["All Classes", ...(payload?.results.map((item) => item.class_name) ?? [])],
    [payload],
  );

  const visibleResults = useMemo(() => {
    if (!payload) return [];
    if (selectedClass === "All Classes") return payload.results;

    return payload.results.filter((item) => item.class_name === selectedClass);
  }, [payload, selectedClass]);

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              Admin Results
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
              Vote Counter
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" isDisabled={isLoading} onPress={loadResults}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Link href="/admin">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <Card.Header>
              <Card.Description>Total ballots</Card.Description>
              <Card.Title>{payload?.total_votes ?? 0}</Card.Title>
            </Card.Header>
          </Card>
          <Card>
            <Card.Header>
              <Card.Description>Valid ballots</Card.Description>
              <Card.Title>{payload?.valid_votes ?? 0}</Card.Title>
            </Card.Header>
          </Card>
          <Card>
            <Card.Header>
              <Card.Description>Invalid ballots</Card.Description>
              <Card.Title>{payload?.invalid_ballots ?? 0}</Card.Title>
            </Card.Header>
          </Card>
          <Card>
            <Card.Header>
              <Card.Description>Classes counted</Card.Description>
              <Card.Title>{payload?.results.length ?? 0}</Card.Title>
            </Card.Header>
          </Card>
        </div>

        <Card>
          <Card.Content>
            <HeroSelect
              label="Results filter"
              options={classOptions}
              value={selectedClass}
              onChange={setSelectedClass}
            />
          </Card.Content>
        </Card>

        {message ? (
          <p className="rounded-lg bg-[#f4d8d8] px-4 py-3 text-sm text-[#6a1f1f]">
            {message}
          </p>
        ) : null}

        {needsResultsUnlock ? (
          <Card className="max-w-2xl">
            <Card.Header className="flex-col items-start gap-1">
              <Card.Title>Two-Key Result Unlock</Card.Title>
              <Card.Description>
                Enter both result keys to decrypt and count ballots.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form className="flex flex-col gap-5" onSubmit={unlockResults}>
                <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
                  Result key 1
                  <input
                    required
                    className="h-11 rounded-md border border-[#d8d2c4] bg-white px-3 text-base outline-none transition focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                    type="password"
                    value={keyOne}
                    onChange={(event) => setKeyOne(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
                  Result key 2
                  <input
                    required
                    className="h-11 rounded-md border border-[#d8d2c4] bg-white px-3 text-base outline-none transition focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                    type="password"
                    value={keyTwo}
                    onChange={(event) => setKeyTwo(event.target.value)}
                  />
                </label>
                <Button type="submit" isDisabled={isUnlocking}>
                  {isUnlocking ? "Unlocking..." : "Unlock Results"}
                </Button>
              </form>
            </Card.Content>
          </Card>
        ) : null}

        {!needsResultsUnlock && visibleResults.length ? (
          visibleResults.map((classResult) => (
            <Card key={classResult.class_name}>
              <Card.Header className="flex-row items-center justify-between gap-3">
                <div>
                  <Card.Title>{classResult.class_name}</Card.Title>
                  <Card.Description>
                    {classResult.total_votes} submitted ballot
                    {classResult.total_votes === 1 ? "" : "s"}
                  </Card.Description>
                </div>
              </Card.Header>
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <CandidateTable title="Male Candidate Results" candidates={classResult.male} />
                <CandidateTable
                  title="Female Candidate Results"
                  candidates={classResult.female}
                />
              </Card.Content>
            </Card>
          ))
        ) : !needsResultsUnlock ? (
          <Card>
            <Card.Content>
              <p className="text-sm text-[#706b61]">
                {isLoading ? "Loading results..." : "No results to show yet."}
              </p>
            </Card.Content>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
