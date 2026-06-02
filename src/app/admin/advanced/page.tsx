"use client";

import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { Button, Card, Link } from "@heroui/react";
import { FormEvent, useState } from "react";

type ResetMode = "votes" | "candidates" | "database";

const resetOptions: Array<{
  mode: ResetMode;
  title: string;
  description: string;
  button: string;
}> = [
  {
    mode: "votes",
    title: "Reset Votes",
    description: "Deletes all encrypted ballots and clears the vote counter.",
    button: "Reset Votes",
  },
  {
    mode: "candidates",
    title: "Reset Candidates",
    description: "Deletes all candidate records. Uploaded image files are left in place.",
    button: "Reset Candidates",
  },
  {
    mode: "database",
    title: "Reset Database",
    description: "Deletes votes, candidates, and audit log rows for a clean election state.",
    button: "Reset Database",
  },
];

export default function AdvancedAdminPage() {
  const [activeMode, setActiveMode] = useState<ResetMode | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMode) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: activeMode, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Reset failed.");
      }

      setPassword("");
      setActiveMode(null);
      setMessage(`Completed ${activeMode} reset.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
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
              Admin Advanced
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
              Reset Controls
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {resetOptions.map((option) => (
            <Card key={option.mode}>
              <Card.Header className="flex-col items-start gap-1">
                <Card.Title>{option.title}</Card.Title>
                <Card.Description>{option.description}</Card.Description>
              </Card.Header>
              <Card.Content>
                <Button
                  variant={option.mode === "database" ? "danger-soft" : "outline"}
                  onPress={() => {
                    setActiveMode(option.mode);
                    setMessage("");
                    setPassword("");
                  }}
                >
                  {option.button}
                </Button>
              </Card.Content>
            </Card>
          ))}
        </div>

        {activeMode ? (
          <Card className="max-w-2xl">
            <Card.Header className="flex-col items-start gap-1">
              <Card.Title>Confirm Reset</Card.Title>
              <Card.Description>
                Re-enter the admin password to confirm the {activeMode} reset.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form className="flex flex-col gap-5" onSubmit={submitReset}>
                <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
                  Admin password
                  <input
                    required
                    className="h-11 rounded-md border border-[#d8d2c4] bg-white px-3 text-base outline-none transition focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    variant={activeMode === "database" ? "danger-soft" : "primary"}
                    isDisabled={isSubmitting}
                  >
                    {isSubmitting ? "Resetting..." : "Confirm Reset"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    isDisabled={isSubmitting}
                    onPress={() => {
                      setActiveMode(null);
                      setPassword("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card.Content>
          </Card>
        ) : null}

        {message ? (
          <p className="rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
