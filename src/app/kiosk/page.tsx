"use client";

import {
  Button,
  Card,
  Spinner,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type KioskState = {
  id: number;
  status: "LOCKED" | "UNLOCKED";
  active_class: string | null;
};

type Candidate = {
  id: number;
  name: string;
  class_name: string;
  gender: "Male" | "Female";
  image_path: string;
};

type StatePayload = {
  state: KioskState;
  candidates: Candidate[];
};

export default function KioskPage() {
  const [state, setState] = useState<KioskState>({
    id: 1,
    status: "LOCKED",
    active_class: null,
  });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedMale, setSelectedMale] = useState<Candidate | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const previousStatusRef = useRef("LOCKED");

  const fetchState = useCallback(async () => {
    const response = await fetch("/api/kiosk/state", { cache: "no-store" });
    if (!response.ok) return;

    const payload = (await response.json()) as StatePayload;
    setState(payload.state);
    setCandidates(payload.candidates);

    if (payload.state.status === "LOCKED") {
      setSelectedMale(null);
      setIsSubmitting(false);
      submitLockRef.current = false;
    }

    if (
      previousStatusRef.current !== "UNLOCKED" &&
      payload.state.status === "UNLOCKED"
    ) {
      setCountdown(60);
      setSelectedMale(null);
      setIsSubmitting(false);
      submitLockRef.current = false;
    }

    previousStatusRef.current = payload.state.status;
  }, []);

  useEffect(() => {
    void fetchState();
    const interval = window.setInterval(fetchState, 1000);
    return () => window.clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (state.status !== "UNLOCKED") return;

    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.status, state.active_class]);

  useEffect(() => {
    if (state.status !== "UNLOCKED" || countdown !== 0) return;

    void fetch("/api/kiosk/update-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LOCKED", active_class: null }),
    });
  }, [countdown, state.status]);

  const maleCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.gender === "Male"),
    [candidates],
  );
  const femaleCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.gender === "Female"),
    [candidates],
  );

  async function submitVote(femaleCandidate: Candidate) {
    if (!selectedMale || submitLockRef.current) return;

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await fetch("/api/kiosk/submit-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ballot: `${selectedMale.name}|${femaleCandidate.name}`,
        }),
      });
    } finally {
      await fetchState();
    }
  }

  const visibleCandidates = selectedMale ? femaleCandidates : maleCandidates;
  const title = selectedMale ? "Choose Female Candidate" : "Choose Male Candidate";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f4ef] px-5 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/80 px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              {state.active_class ?? "No Active Class"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-[#171717]">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {selectedMale ? (
              <Button
                variant="secondary"
                isDisabled={isSubmitting}
                onPress={() => setSelectedMale(null)}
              >
                Back
              </Button>
            ) : null}
            <div className="min-w-24 rounded-lg bg-[#1f3f3a] px-4 py-2 text-center text-white">
              <p className="text-xs uppercase tracking-[0.14em]">Time</p>
              <p className="text-2xl font-semibold tabular-nums">{countdown}s</p>
            </div>
          </div>
        </header>

        {isSubmitting ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-white/70 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4 rounded-xl bg-white px-8 py-7 shadow-xl">
              <Spinner size="lg" color="current" />
              <p className="text-lg font-semibold">Submitting vote</p>
            </div>
          </div>
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

        {visibleCandidates.length === 0 && state.status === "UNLOCKED" ? (
          <div className="grid flex-1 place-items-center rounded-xl bg-white/80 p-8 text-center">
            <p className="text-xl font-semibold text-[#34302a]">
              No {selectedMale ? "female" : "male"} candidates found for{" "}
              {state.active_class}.
            </p>
          </div>
        ) : null}
      </section>

      {state.status === "LOCKED" ? (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[#171717]/55 p-6 backdrop-blur-lg">
          <div className="max-w-md rounded-xl bg-white px-8 py-7 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              Kiosk Locked
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#171717]">
              Waiting for admin unlock
            </h2>
          </div>
        </div>
      ) : null}
    </main>
  );
}
