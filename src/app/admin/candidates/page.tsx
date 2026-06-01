"use client";

import { Button, Card, Link } from "@heroui/react";
import { HeroSelect } from "@/components/HeroSelect";
import { schoolClasses } from "@/lib/classes";
import { FormEvent, useRef, useState } from "react";

const genders = ["Male", "Female"];

export default function CandidatesPage() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("Class 9A");
  const [gender, setGender] = useState("Male");
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      if (!image) {
        throw new Error("Choose a candidate image.");
      }

      const formData = new FormData();
      formData.set("name", name);
      formData.set("class_name", className);
      formData.set("gender", gender);
      formData.set("image", image);

      const response = await fetch("/api/admin/candidates", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Candidate creation failed.");
      }

      setName("");
      setImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      setMessage(`Saved ${payload.candidate.name} for ${payload.candidate.class_name}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Candidate creation failed.",
      );
    } finally {
      setIsSubmitting(false);
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
        </div>

        <Card className="max-w-2xl">
          <Card.Header className="flex-col items-start gap-1">
            <Card.Title>Add Candidate</Card.Title>
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
                  className="h-11 rounded-md border border-[#d8d2c4] bg-white px-3 text-base outline-none transition focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <HeroSelect
                label="Class"
                options={schoolClasses}
                value={className}
                onChange={setClassName}
              />
              <HeroSelect
                label="Gender"
                options={genders}
                value={gender}
                onChange={setGender}
              />
              <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
                Candidate image
                <input
                  ref={imageInputRef}
                  required
                  accept="image/*"
                  className="rounded-md border border-[#d8d2c4] bg-white px-3 py-2 text-base outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-[#ece8dd] file:px-3 file:py-2 focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                  type="file"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                />
              </label>
              <Button type="submit" isDisabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Candidate"}
              </Button>
            </form>

            {message ? (
              <p className="mt-5 rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
                {message}
              </p>
            ) : null}
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
