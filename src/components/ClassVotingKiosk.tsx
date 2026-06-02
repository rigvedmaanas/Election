"use client";

import { Button, Card, Spinner } from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Candidate = {
  id: number;
  name: string;
  class_name: string;
  gender: "Male" | "Female";
  image_path: string;
};

type StatePayload = {
  class_name: string;
  candidates: Candidate[];
};

type VotingPhase = "idle" | "voting" | "cooldown";

export function ClassVotingKiosk({ className }: { className: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [phase, setPhase] = useState<VotingPhase>("idle");
  const [selectedMale, setSelectedMale] = useState<Candidate | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/kiosk/state?class_name=${encodeURIComponent(className)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as StatePayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load candidates.");
      }

      setCandidates(payload.candidates);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load candidates.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [className]);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    if (phase !== "cooldown" || cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown, phase]);

  useEffect(() => {
    if (phase === "cooldown" && cooldown === 0) {
      setPhase("idle");
      setSelectedMale(null);
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }, [cooldown, phase]);

  const maleCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.gender === "Male"),
    [candidates],
  );
  const femaleCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.gender === "Female"),
    [candidates],
  );

  function startVoting() {
    setMessage("");
    setSelectedMale(null);
    setIsSubmitting(false);
    submitLockRef.current = false;
    setPhase("voting");
  }

  async function submitVote(femaleCandidate: Candidate) {
    if (!selectedMale || submitLockRef.current) return;

    submitLockRef.current = true;
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/kiosk/submit-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: className,
          ballot: `${selectedMale.name}|${femaleCandidate.name}`,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not submit vote.");
      }

      setSelectedMale(null);
      setCooldown(10);
      setPhase("cooldown");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit vote.");
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  const visibleCandidates = selectedMale ? femaleCandidates : maleCandidates;
  const title = selectedMale ? "Choose Female Candidate" : "Choose Male Candidate";

  if (phase === "idle") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-8">
        <section className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              {className}
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-[#171717]">
              Voting Terminal
            </h1>
          </div>
          <Button
            className="min-h-24 min-w-72 text-3xl font-semibold"
            isDisabled={isLoading || candidates.length === 0}
            onPress={startVoting}
          >
            {isLoading ? "Loading..." : "Start Voting"}
          </Button>
          {message || candidates.length === 0 ? (
            <p className="rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
              {message || `No candidates found for ${className}.`}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  if (phase === "cooldown") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-8">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
            Vote Submitted
          </p>
          <h1 className="mt-3 text-5xl font-semibold text-[#171717]">
            Next voter in {cooldown}s
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f4ef] px-5 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/80 px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              {className}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-[#171717]">{title}</h1>
          </div>
          {selectedMale ? (
            <Button
              variant="secondary"
              isDisabled={isSubmitting}
              onPress={() => setSelectedMale(null)}
            >
              Back
            </Button>
          ) : null}
        </header>

        {isSubmitting ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-white/70 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4 rounded-xl bg-white px-8 py-7 shadow-xl">
              <Spinner size="lg" color="current" />
              <p className="text-lg font-semibold">Submitting vote</p>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="rounded-lg bg-[#f4d8d8] px-4 py-3 text-sm text-[#6a1f1f]">
            {message}
          </p>
        ) : null}

        <div className="kiosk-grid grid flex-1 gap-5">
          {visibleCandidates.map((candidate) => (
            <button
              key={candidate.id}
              className="group text-left outline-none disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() =>
                selectedMale ? submitVote(candidate) : setSelectedMale(candidate)
              }
            >
              <Card className="min-h-[320px] transition group-hover:scale-[1.01] group-focus-visible:ring-4 group-focus-visible:ring-[#1f3f3a]/30">
                <Card.Header className="pb-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-default-500">
                    {candidate.gender}
                  </p>
                </Card.Header>
                <Card.Content className="items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={candidate.name}
                    className="aspect-square h-56 w-56 rounded-md object-cover"
                    src={candidate.image_path}
                  />
                </Card.Content>
                <Card.Footer className="justify-center">
                  <p className="text-center text-2xl font-semibold text-[#171717]">
                    {candidate.name}
                  </p>
                </Card.Footer>
              </Card>
            </button>
          ))}
        </div>

        {visibleCandidates.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl bg-white/80 p-8 text-center">
            <p className="text-xl font-semibold text-[#34302a]">
              No {selectedMale ? "female" : "male"} candidates found for{" "}
              {className}.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
