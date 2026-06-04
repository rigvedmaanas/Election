"use client";

import { Button, Card, Link } from "@heroui/react";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { HeroSelect } from "@/components/HeroSelect";
import { schoolClasses } from "@/lib/classes";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const genders = ["Male", "Female"];

type Candidate = {
  id: number;
  name: string;
  class_name: string;
  gender: string;
  image_path: string;
  votes: number;
};

export default function CandidatesPage() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("Class 9A");
  const [gender, setGender] = useState("Male");
  const [image, setImage] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [listMessage, setListMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editingCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === editingId) ?? null,
    [candidates, editingId],
  );
  const hasVoteLinkedIdentity = (editingCandidate?.votes ?? 0) > 0;

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setListMessage("");

    try {
      const response = await fetch("/api/admin/candidates");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load candidates.");
      }

      setCandidates(payload.candidates);
    } catch (error) {
      setListMessage(
        error instanceof Error ? error.message : "Could not load candidates.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  function resetForm() {
    setName("");
    setClassName("Class 9A");
    setGender("Male");
    setImage(null);
    setEditingId(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      if (!editingId && !image) {
        throw new Error("Choose a candidate image.");
      }

      const formData = new FormData();
      if (editingId) {
        formData.set("id", String(editingId));
      }
      formData.set("name", name);
      formData.set("class_name", className);
      formData.set("gender", gender);
      if (image) {
        formData.set("image", image);
      }

      const response = await fetch("/api/admin/candidates", {
        method: editingId ? "PUT" : "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Candidate save failed.");
      }

      resetForm();
      await loadCandidates();
      setMessage(`Saved ${payload.candidate.name} for ${payload.candidate.class_name}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Candidate save failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function editCandidate(candidate: Candidate) {
    setEditingId(candidate.id);
    setName(candidate.name);
    setClassName(candidate.class_name);
    setGender(candidate.gender);
    setImage(null);
    setMessage("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function removeCandidate(candidate: Candidate) {
    if (candidate.votes > 0) return;

    const confirmed = window.confirm(`Remove ${candidate.name}?`);

    if (!confirmed) return;

    setDeletingId(candidate.id);
    setListMessage("");

    try {
      const response = await fetch(`/api/admin/candidates?id=${candidate.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not remove candidate.");
      }

      if (editingId === candidate.id) {
        resetForm();
      }
      await loadCandidates();
      setListMessage(`Removed ${candidate.name}.`);
    } catch (error) {
      setListMessage(
        error instanceof Error ? error.message : "Could not remove candidate.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              Admin Setup
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
              Candidate Profiles
            </h1>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Dashboard</Button>
          </Link>
          <AdminLogoutButton />
        </div>

        <Card className="max-w-2xl">
          <Card.Header className="flex-col items-start gap-1">
            <Card.Title>{editingId ? "Edit Candidate" : "Add Candidate"}</Card.Title>
            <Card.Description>
              Images are stored locally in public/uploads.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-5" onSubmit={submitCandidate}>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
                Candidate name
                <input
                  required
                  disabled={hasVoteLinkedIdentity}
                  className="h-11 rounded-md border border-[#d8d2c4] bg-white px-3 text-base outline-none transition focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <HeroSelect
                label="Class"
                options={schoolClasses}
                value={className}
                onChange={(value) => {
                  if (!hasVoteLinkedIdentity) setClassName(value);
                }}
              />
              <HeroSelect
                label="Gender"
                options={genders}
                value={gender}
                onChange={(value) => {
                  if (!hasVoteLinkedIdentity) setGender(value);
                }}
              />
              <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
                Candidate image
                <input
                  ref={imageInputRef}
                  required={!editingId}
                  accept="image/*"
                  className="rounded-md border border-[#d8d2c4] bg-white px-3 py-2 text-base outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-[#ece8dd] file:px-3 file:py-2 focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                  type="file"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                />
              </label>
              {hasVoteLinkedIdentity ? (
                <p className="rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
                  This candidate has votes, so only the image can be changed.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" isDisabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingId ? "Update Candidate" : "Save Candidate"}
                </Button>
                {editingId ? (
                  <Button type="button" variant="secondary" onPress={resetForm}>
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </form>

            {message ? (
              <p className="mt-5 rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
                {message}
              </p>
            ) : null}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex-col items-start gap-1">
            <Card.Title>Existing Candidates</Card.Title>
            <Card.Description>
              Candidates can be removed only when their vote count is zero.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {listMessage ? (
              <p className="mb-4 rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
                {listMessage}
              </p>
            ) : null}

            {isLoading ? (
              <p className="text-sm text-[#706b61]">Loading candidates...</p>
            ) : candidates.length ? (
              <div className="grid gap-3">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="grid gap-4 rounded-md border border-[#d8d2c4] bg-white p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                  >
                    <Image
                      alt={candidate.name}
                      className="h-[72px] w-[72px] rounded-md object-cover"
                      height={72}
                      src={candidate.image_path}
                      width={72}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#171717]">
                        {candidate.name}
                      </p>
                      <p className="mt-1 text-sm text-[#706b61]">
                        {candidate.class_name} · {candidate.gender} · {candidate.votes} vote
                        {candidate.votes === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onPress={() => editCandidate(candidate)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        isDisabled={candidate.votes > 0 || deletingId === candidate.id}
                        onPress={() => removeCandidate(candidate)}
                      >
                        {deletingId === candidate.id ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#706b61]">No candidates found.</p>
            )}
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
