"use client";

import { Button, Card, Link } from "@heroui/react";
import { classToSlug, schoolClasses } from "@/lib/classes";

export default function KioskLinksPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
            Voting Terminals
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
            Select Class URL
          </h1>
        </div>
        <Card>
          <Card.Content>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schoolClasses.map((className) => {
                const href = `/${classToSlug(className)}`;

                return (
                  <Link key={className} href={href}>
                    <Button className="w-full justify-between" variant="outline">
                      <span>{className}</span>
                      <span>{href}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
