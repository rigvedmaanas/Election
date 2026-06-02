"use client";

import { Button, Card, Link } from "@heroui/react";
import { classToSlug, schoolClasses } from "@/lib/classes";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              Admin Control
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
              Class Voting Links
            </h1>
          </div>
          <Link href="/admin/candidates">
            <Button variant="secondary">Candidate Profiles</Button>
          </Link>
          <Link href="/admin/results">
            <Button variant="outline">Results</Button>
          </Link>
          <Link href="/admin/logs">
            <Button variant="outline">Logs</Button>
          </Link>
          <Link href="/admin/advanced">
            <Button variant="danger-soft">Advanced</Button>
          </Link>
          <AdminLogoutButton />
        </div>

        <Card>
          <Card.Header className="flex-col items-start gap-1">
            <Card.Title>Voting URLs</Card.Title>
            <Card.Description>
              Each class has its own local voting terminal URL.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schoolClasses.map((className) => {
                const href = `/${classToSlug(className)}`;

                return (
                  <div
                    key={className}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#ddd6c8] bg-white px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-[#171717]">{className}</p>
                      <p className="text-sm text-[#706b61]">{href}</p>
                    </div>
                    <Link href={href}>
                      <Button variant="outline">Open</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
