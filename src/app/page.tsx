"use client";

import { Button, Card, Link } from "@heroui/react";
import { classToSlug, schoolClasses } from "@/lib/classes";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-6 py-10">
      <section className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f6a5d]">
            Local Election Console
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#171717]">
            School Election System
          </h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <Card.Header>
              <Card.Title>Admin</Card.Title>
            </Card.Header>
            <Card.Content className="gap-4">
              <p className="text-sm text-default-600">
                Manage candidates, results, logs, and class voting links.
              </p>
              <Link href="/admin" className="w-fit">
                <Button>Open Dashboard</Button>
              </Link>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Candidates</Card.Title>
            </Card.Header>
            <Card.Content className="gap-4">
              <p className="text-sm text-default-600">
                Add candidate names, classes, genders, and local images.
              </p>
              <Link href="/admin/candidates" className="w-fit">
                <Button variant="secondary">Manage Candidates</Button>
              </Link>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Class Links</Card.Title>
            </Card.Header>
            <Card.Content className="gap-4">
              <p className="text-sm text-default-600">
                Launch a separate voting terminal for each class.
              </p>
              <Link href="/kiosk" className="w-fit">
                <Button variant="tertiary">View Links</Button>
              </Link>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Results</Card.Title>
            </Card.Header>
            <Card.Content className="gap-4">
              <p className="text-sm text-default-600">
                Count encrypted ballots by class and candidate.
              </p>
              <Link href="/admin/results" className="w-fit">
                <Button variant="outline">View Counter</Button>
              </Link>
            </Card.Content>
          </Card>
        </div>
        <Card>
          <Card.Header>
            <Card.Title>Direct Class Voting URLs</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {schoolClasses.map((className) => (
                <Link key={className} href={`/${classToSlug(className)}`}>
                  {`/${classToSlug(className)}`}
                </Link>
              ))}
            </div>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
