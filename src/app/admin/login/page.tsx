"use client";

import { Button, Card } from "@heroui/react";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const value = searchParams.get("next");

    return value?.startsWith("/admin") ? value : "/admin";
  }, [searchParams]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Login failed.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-8">
      <Card className="w-full max-w-md">
        <Card.Header className="flex-col items-start gap-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
            Admin Login
          </p>
          <Card.Title>School Election</Card.Title>
          <Card.Description>Enter the admin password to continue.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="flex flex-col gap-5" onSubmit={submitLogin}>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
              Password
              <input
                autoFocus
                required
                className="h-11 rounded-md border border-[#d8d2c4] bg-white px-3 text-base outline-none transition focus:border-[#1f3f3a] focus:ring-4 focus:ring-[#1f3f3a]/15"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <Button type="submit" isDisabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {message ? (
            <p className="mt-5 rounded-lg bg-[#f4d8d8] px-4 py-3 text-sm text-[#6a1f1f]">
              {message}
            </p>
          ) : null}
        </Card.Content>
      </Card>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-8">
          <p className="text-sm text-[#706b61]">Loading login...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
