"use client";

import { Button, Card, Spinner } from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

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

function sortCandidatesByName(candidateList: Candidate[]) {
  return [...candidateList].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
  );
}

async function playSubmitBeep() {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) return;

  try {
    const audioContext = new AudioContextConstructor();

    // 1. Fetch the audio file
    const response = await fetch("beep.wav"); // Update with your file path (.mp3, .wav, etc.)
    const arrayBuffer = await response.arrayBuffer();

    // 2. Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 3. Create a buffer source node
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // 4. Create a gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime); // Adjust volume here (0.0 to 1.0)

    // 5. Connect and play
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);

    // 6. Automatically close the context after the sound finishes
    source.onended = () => {
      void audioContext.close();
    };
  } catch (error) {
    // Ignore audio failures so voting still works if sound is unavailable.
    console.error("Audio playback failed:", error);
  }
}

export function ClassVotingKiosk({ className }: { className: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [phase, setPhase] = useState<VotingPhase>("idle");
  const [selectedMale, setSelectedMale] = useState<Candidate | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null,
  );
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
      const payload = (await response.json()) as StatePayload & {
        error?: string;
      };

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
      setSelectedCandidateId(null);
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }, [cooldown, phase]);

  const maleCandidates = useMemo(
    () =>
      sortCandidatesByName(
        candidates.filter((candidate) => candidate.gender === "Male"),
      ),
    [candidates],
  );
  const femaleCandidates = useMemo(
    () =>
      sortCandidatesByName(
        candidates.filter((candidate) => candidate.gender === "Female"),
      ),
    [candidates],
  );

  function startVoting() {
    setMessage("");
    setSelectedMale(null);
    setSelectedCandidateId(null);
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
      playSubmitBeep();
      setSelectedMale(null);
      setSelectedCandidateId(null);
      setCooldown(10);
      setPhase("cooldown");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not submit vote.",
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  const visibleCandidates = selectedMale ? femaleCandidates : maleCandidates;
  const selectedCandidate =
    visibleCandidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    ) ?? null;
  const title = selectedMale
    ? "Choose Female Candidate"
    : "Choose Male Candidate";

  function submitSelection() {
    if (!selectedCandidate || isSubmitting) return;

    if (!selectedMale) {
      setSelectedMale(selectedCandidate);
      setSelectedCandidateId(null);
      setMessage("");
      return;
    }

    void submitVote(selectedCandidate);
  }

  if (phase === "idle") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-8">
        <section className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <Image src="/Logo.png" width={100} height={100} alt="Logo" />
          <div>
            <h1 className="my-3 text-4xl font-semibold text-[#171717]">
              Voting Terminal
            </h1>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              {className}
            </p>
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
            <h1 className="mt-1 text-3xl font-semibold text-[#171717]">
              {title}
            </h1>
          </div>
          {selectedMale ? (
            <Button
              variant="secondary"
              isDisabled={isSubmitting}
              onPress={() => {
                setSelectedMale(null);
                setSelectedCandidateId(null);
              }}
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

        <div className="flex flex-1 flex-col gap-4">
          {visibleCandidates.map((candidate) => (
            <label
              key={candidate.id}
              className="group cursor-pointer text-left has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <input
                checked={selectedCandidateId === candidate.id}
                className="peer sr-only"
                disabled={isSubmitting}
                name="candidate"
                type="radio"
                value={candidate.id}
                onChange={() => setSelectedCandidateId(candidate.id)}
              />
              <Card className="transition peer-checked:ring-4 peer-checked:ring-[#1f3f3a]/45 group-hover:scale-[1.005] group-focus-within:ring-4 group-focus-within:ring-[#1f3f3a]/30">
                <Card.Content className="flex flex-row items-center gap-5 p-4">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                      selectedCandidateId === candidate.id
                        ? "border-[#1f3f3a]"
                        : "border-[#6f766f]"
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded-full bg-[#1f3f3a] ${
                        selectedCandidateId === candidate.id
                          ? "block"
                          : "hidden"
                      }`}
                    />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={candidate.name}
                    className="aspect-square h-28 w-28 shrink-0 rounded-md object-cover"
                    src={candidate.image_path}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-default-500">
                      {candidate.gender}
                    </p>
                    <p className="mt-1 break-words text-3xl font-semibold text-[#171717]">
                      {candidate.name}
                    </p>
                  </div>
                </Card.Content>
              </Card>
            </label>
          ))}
        </div>

        {visibleCandidates.length > 0 ? (
          <footer className="sticky bottom-0 -mx-5 bg-[#f6f4ef]/95 px-5 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-7xl justify-end">
              <Button
                className="min-h-16 min-w-56 text-2xl font-semibold"
                isDisabled={!selectedCandidate || isSubmitting}
                onPress={submitSelection}
              >
                Submit
              </Button>
            </div>
          </footer>
        ) : null}

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
