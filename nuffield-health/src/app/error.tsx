"use client";

import { GlassCard } from "@/components/ui/glass-card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 px-4">
      <GlassCard className="max-w-lg text-center space-y-4">
        <h1 className="text-h2 text-[var(--text-primary)]">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
        >
          Try again
        </button>
      </GlassCard>
    </div>
  );
}
