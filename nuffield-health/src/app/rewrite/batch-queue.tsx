"use client";

import { CheckCircle, AlertCircle, Loader2, Clock, PauseCircle, XCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

export type BatchItemStatus = "pending" | "in_progress" | "complete" | "failed";

export interface BatchItem {
  slug: string;
  name: string;
  status: BatchItemStatus;
}

interface BatchQueueProps {
  items: BatchItem[];
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const STATUS_CONFIG: Record<BatchItemStatus, { icon: React.ReactNode; label: string; color: string }> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    label: "Pending",
    color: "var(--text-muted)",
  },
  in_progress: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: "In progress",
    color: "var(--sensai-teal)",
  },
  complete: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Complete",
    color: "var(--success)",
  },
  failed: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Failed",
    color: "var(--danger)",
  },
};

export function BatchQueue({ items, isPaused, onPause, onResume, onCancel }: BatchQueueProps) {
  const total = items.length;
  const complete = items.filter((i) => i.status === "complete").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const inProgress = items.find((i) => i.status === "in_progress");

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Batch Queue
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {complete}/{total} complete
            {failed > 0 && <span className="text-[var(--danger)] ml-1">({failed} failed)</span>}
            {isPaused && <span className="text-[var(--warning)] ml-1"> · Paused</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? onResume : onPause}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            <PauseCircle className="h-3.5 w-3.5" />
            {isPaused ? "Resume Batch" : "Pause Batch"}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel Remaining
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--sensai-teal)] transition-all"
          style={{ width: `${(complete / total) * 100}%` }}
        />
      </div>

      {/* Queue list */}
      <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
        {items.map((item) => {
          const config = STATUS_CONFIG[item.status];
          return (
            <div
              key={item.slug}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                item.status === "in_progress" && "bg-[var(--sensai-teal)]/5 border border-[var(--sensai-teal)]/20"
              )}
            >
              <span style={{ color: config.color }}>{config.icon}</span>
              <span
                className={cn(
                  "flex-1 truncate",
                  item.status === "in_progress"
                    ? "text-[var(--text-primary)] font-medium"
                    : item.status === "complete"
                    ? "text-[var(--text-secondary)] line-through"
                    : "text-[var(--text-secondary)]"
                )}
              >
                {item.name}
              </span>
              <span className="text-[10px] shrink-0" style={{ color: config.color }}>
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
