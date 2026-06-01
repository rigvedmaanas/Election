"use client";

import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { Button, Card, Link } from "@heroui/react";
import { useEffect, useState } from "react";

type AuditLog = {
  id: number;
  action: string;
  details: string | null;
  created_at: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadLogs() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/logs", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load logs.");
      }

      setLogs(data.logs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load logs.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#706b61]">
              Admin Audit
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171717]">
              System Logs
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" isDisabled={isLoading} onPress={loadLogs}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Link href="/admin">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        {message ? (
          <p className="rounded-lg bg-[#f4d8d8] px-4 py-3 text-sm text-[#6a1f1f]">
            {message}
          </p>
        ) : null}

        <Card>
          <Card.Content>
            <div className="overflow-hidden rounded-lg border border-[#ddd6c8] bg-white">
              <div className="grid grid-cols-[80px_180px_190px_1fr] gap-3 border-b border-[#ddd6c8] bg-[#f3efe6] px-4 py-3 text-sm font-semibold text-[#34302a]">
                <span>ID</span>
                <span>Action</span>
                <span>Time</span>
                <span>Details</span>
              </div>
              <div className="divide-y divide-[#eee8dc]">
                {logs.length ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-[80px_180px_190px_1fr] gap-3 px-4 py-3 text-sm"
                    >
                      <span className="font-semibold text-[#706b61]">{log.id}</span>
                      <span className="font-medium text-[#171717]">{log.action}</span>
                      <span className="text-[#706b61]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      <span className="break-words font-mono text-xs text-[#34302a]">
                        {log.details ?? ""}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-4 text-sm text-[#706b61]">
                    {isLoading ? "Loading logs..." : "No logs yet."}
                  </p>
                )}
              </div>
            </div>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
