"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementRewriteResult, RewritableElementKey } from "@/lib/types";

interface SourceEvidencePanelProps {
  elementKey: RewritableElementKey | null;
  elementLabel: string | null;
  result: ElementRewriteResult | null;
}

export function SourceEvidencePanel({
  elementKey,
  elementLabel,
  result,
}: SourceEvidencePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!elementKey || !result || !result.sources || result.sources.length === 0) {
    return (
      <div
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-sm text-[var(--text-muted)]">
          Source Evidence Panel — select an element with results to view sources
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </div>
    );
  }

  const corroboratedSources = result.sources.filter((s) => s.corroborated);
  const singleSources = result.sources.filter((s) => !s.corroborated);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Source Evidence
          </span>
          {elementLabel && (
            <span className="text-xs text-[var(--text-muted)]">— {elementLabel}</span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              corroboratedSources.length > 0
                ? "text-[var(--success)] bg-[var(--success)]/10"
                : "text-[var(--warning)] bg-[var(--warning)]/10"
            )}
          >
            {corroboratedSources.length > 0 ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {result.sources.length} source{result.sources.length !== 1 ? "s" : ""}
            {corroboratedSources.length > 0 && `, ${corroboratedSources.length} corroborated`}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)] px-4 py-4 max-h-[280px] overflow-y-auto space-y-4">
          {corroboratedSources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--success)] mb-2 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Corroborated sources (confirmed in 2+ sources)
              </p>
              <div className="space-y-3">
                {corroboratedSources.map((source) => (
                  <SourceItem key={source.source_id} source={source} corroborated />
                ))}
              </div>
            </div>
          )}

          {singleSources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--warning)] mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Single-source facts (use with caution)
              </p>
              <div className="space-y-3">
                {singleSources.map((source) => (
                  <SourceItem key={source.source_id} source={source} corroborated={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourceItem({
  source,
  corroborated,
}: {
  source: { source_id: string; url: string; title: string | null; corroborated: boolean };
  corroborated: boolean;
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] p-3">
      <div className="flex items-start gap-2 mb-1">
        {corroborated ? (
          <CheckCircle className="h-3.5 w-3.5 text-[var(--success)] mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning)] mt-0.5 shrink-0" />
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--sensai-teal)] hover:text-[var(--sensai-teal-light)] hover:underline break-all"
        >
          {source.title ?? source.url}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
      <p className="ml-5 text-[10px] text-[var(--text-muted)] break-all">{source.url}</p>
    </div>
  );
}
