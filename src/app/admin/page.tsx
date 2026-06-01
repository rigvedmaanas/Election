"use client";

import {
  Button,
  Card,
  Link,
} from "@heroui/react";
import { HeroSelect } from "@/components/HeroSelect";
import { schoolClasses } from "@/lib/classes";
import { useState } from "react";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

export default function AdminPage() {
  const [selectedClass, setSelectedClass] = useState("Class 9A");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function updateKiosk(status: "LOCKED" | "UNLOCKED") {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/kiosk/update-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          active_class: status === "UNLOCKED" ? selectedClass : null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Kiosk update failed.");
      }

      setMessage(
        status === "UNLOCKED"
          ? `Kiosk unlocked for ${selectedClass}.`
          : "Kiosk locked and active class cleared.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Kiosk update failed.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              Admin Control
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
              Kiosk Dashboard
            </h1>
          </div>
          <Link href="/admin/candidates">
            <Button variant="secondary">Candidate Profiles</Button>
          </Link>
          <Link href="/admin/results">
            <Button variant="outline">Results</Button>
          </Link>
          <AdminLogoutButton />
        </div>

        <Card className="max-w-2xl">
          <Card.Header className="flex-col items-start gap-1">
            <Card.Title>Session Control</Card.Title>
            <Card.Description>
              Select the class currently allowed to vote.
            </Card.Description>
          </Card.Header>
          <Card.Content className="gap-5">
            <HeroSelect
              label="Active class"
              options={schoolClasses}
              value={selectedClass}
              onChange={setSelectedClass}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                isDisabled={isBusy}
                onPress={() => updateKiosk("UNLOCKED")}
              >
                {isBusy ? "Working..." : "Unlock Kiosk"}
              </Button>
              <Button
                variant="danger-soft"
                isDisabled={isBusy}
                onPress={() => updateKiosk("LOCKED")}
              >
                Emergency Lock
              </Button>
              <Link href="/kiosk">
                <Button variant="outline">Open Kiosk</Button>
              </Link>
              <Link href="/admin/results">
                <Button variant="secondary">View Results</Button>
              </Link>
            </div>

            {message ? (
              <p className="rounded-lg bg-[#ece8dd] px-4 py-3 text-sm text-[#34302a]">
                {message}
              </p>
            ) : null}
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
