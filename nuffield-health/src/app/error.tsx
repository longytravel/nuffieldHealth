"use client";

import { GlassCard } from "@/components/ui/glass-card";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDbError =
    error.message?.includes("Database unavailable") ||
    error.message?.includes("no such table") ||
    error.message?.includes("better-sqlite3");

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 px-4">
      <GlassCard className="max-w-lg text-center space-y-4">
        <h1 className="text-h2 text-[var(--text-primary)]">
          {isDbError ? "Demo Mode" : "Something went wrong"}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {isDbError
            ? "This page requires live data from the scraper pipeline. The database is only available when running locally."
            : "An unexpected error occurred. Please try again."}
        </p>
        {isDbError && (
          <div className="rounded-lg bg-[var(--bg-secondary)] p-4 text-left">
            <p className="text-xs font-mono text-[var(--text-muted)]">
              To view live data, run locally:
            </p>
            <pre className="mt-2 text-xs font-mono text-[var(--sensai-teal)]">
              cd nuffield-health{"\n"}pnpm dev
            </pre>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
