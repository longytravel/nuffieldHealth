"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import type { RewritableElementKey, ElementRewriteResult } from "@/lib/types";

export type ElementStatus =
  | "not_started"
  | "researching"
  | "complete"
  | "no_data"
  | "insufficient_sources";

interface ElementCardProps {
  elementKey: RewritableElementKey;
  label: string;
  maxPoints: number;
  currentPoints: number;
  currentContent: string | null;
  checked: boolean;
  onCheckChange: (checked: boolean) => void;
  status: ElementStatus;
  result?: ElementRewriteResult | null;
  isSelected: boolean;
  onSelect: () => void;
}

const STATUS_CONFIG: Record<ElementStatus, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "var(--text-muted)" },
  researching: { label: "Researching...", color: "var(--sensai-teal)" },
  complete: { label: "Complete", color: "var(--success)" },
  no_data: { label: "No data found", color: "var(--warning)" },
  insufficient_sources: { label: "Insufficient sources", color: "var(--warning)" },
};

/** Strip markdown syntax and Haiku noise for plain-text display */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")  // headings
    .replace(/^IMPROVED\s+\w+\s*/i, "") // "IMPROVED BIOGRAPHY" prefix
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1")     // italic
    .replace(/```[\s\S]*?```/g, "")   // code blocks
    .replace(/`(.+?)`/g, "$1")        // inline code
    .trim();
}

/** Clean a JSON array that may contain double-encoded items, bracket artifacts, or markdown noise */
function cleanArrayItems(items: unknown[]): string[] {
  return items
    .map((item) => String(item).replace(/^"+|"+$/g, "").trim())
    .filter((item) => {
      if (item === "" || item === "[" || item === "]") return false;
      if (item.startsWith("```") || item.startsWith("*Note:")) return false;
      // Filter out markdown headings and notes sections from Haiku output
      if (/^#{1,6}\s/.test(item)) return false;
      return true;
    });
}

function renderContent(content: string | null, elementKey: RewritableElementKey, isProposed = false, expanded = false): React.ReactNode {
  if (!content) return <span className="italic text-[var(--text-muted)]">Missing</span>;

  if (elementKey === "treatments" || elementKey === "memberships" || elementKey === "specialty_sub" || elementKey === "clinical_interests") {
    try {
      const raw = JSON.parse(content) as unknown[];
      if (Array.isArray(raw)) {
        const items = cleanArrayItems(raw);
        const limit = expanded ? items.length : (isProposed ? 8 : 5);
        return (
          <ul className="space-y-1">
            {items.slice(0, limit).map((item, i) => (
              <li key={i} className="text-xs text-[var(--text-secondary)]">• {item}</li>
            ))}
            {!expanded && items.length > limit && (
              <li className="text-xs text-[var(--text-muted)]">+{items.length - limit} more</li>
            )}
          </ul>
        );
      }
    } catch {
      // fall through to plain text
    }
  }

  const displayText = isProposed ? stripMarkdown(content) : content;

  return (
    <p className={cn(
      "text-xs text-[var(--text-secondary)] leading-relaxed",
      !expanded && "line-clamp-4"
    )}>{displayText}</p>
  );
}

export function ElementCard({
  elementKey,
  label,
  maxPoints,
  currentPoints,
  currentContent,
  checked,
  onCheckChange,
  status,
  result,
  isSelected,
  onSelect,
}: ElementCardProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[status];
  const hasResult = result && result.rewritten_content;
  const projectedPoints = result?.projected_delta != null
    ? Math.min(maxPoints, currentPoints + result.projected_delta)
    : null;

  const corroboratedSources = result?.sources?.filter(s => s.corroborated) ?? [];
  const singleSources = result?.sources?.filter(s => !s.corroborated) ?? [];
  const totalSources = result?.sources?.length ?? 0;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        isSelected
          ? "border-[var(--sensai-teal)]/50 bg-[var(--sensai-teal)]/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-glass)]"
      )}
    >
      <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
        {/* Left — Current */}
        <div
          className="p-4 cursor-pointer"
          onClick={onSelect}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
              <span className="ml-2 text-xs text-[var(--text-muted)] font-mono">
                {currentPoints}/{maxPoints} pts
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: statusConfig.color,
                  backgroundColor: `${statusConfig.color}15`,
                }}
              >
                {statusConfig.label}
              </span>
              <label
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onCheckChange(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] accent-[var(--sensai-teal)]"
                />
                Include
              </label>
            </div>
          </div>

          <div className={cn("min-h-[80px]", contentExpanded && "min-h-0")}>
            {renderContent(currentContent, elementKey, false, contentExpanded)}
          </div>

          {currentContent && currentContent.length > 150 && (
            <button
              onClick={(e) => { e.stopPropagation(); setContentExpanded(!contentExpanded); }}
              className="mt-1 text-[10px] text-[var(--sensai-teal)] hover:underline"
            >
              {contentExpanded ? "Show less" : "Show more"}
            </button>
          )}

          {maxPoints > 0 && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(currentPoints / maxPoints) * 100}%`,
                  backgroundColor: currentPoints === maxPoints
                    ? "var(--success)"
                    : currentPoints > 0
                    ? "var(--warning)"
                    : "var(--danger)",
                }}
              />
            </div>
          )}
        </div>

        {/* Right — Proposed */}
        <div className="p-4">
          {!hasResult && status === "not_started" && (
            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)] italic">
              Run rewrite to see proposed content
            </div>
          )}
          {!hasResult && status === "researching" && (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-[var(--sensai-teal)]">
                <div className="h-3 w-3 rounded-full border-2 border-[var(--sensai-teal)] border-t-transparent animate-spin" />
                Researching...
              </div>
            </div>
          )}
          {!hasResult && (status === "no_data" || status === "insufficient_sources") && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 text-[var(--warning)] mx-auto mb-1" />
                <p className="text-xs text-[var(--text-muted)]">Insufficient verified data</p>
              </div>
            </div>
          )}
          {hasResult && (
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {projectedPoints !== null && (
                    <span className="text-xs font-medium text-[var(--success)] font-mono">
                      {currentPoints} → {projectedPoints} pts
                      {result.projected_delta && result.projected_delta > 0 && (
                        <span className="ml-1 text-[var(--success)]">(+{result.projected_delta})</span>
                      )}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSourcesExpanded(!sourcesExpanded)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0",
                    totalSources >= 2
                      ? "text-[var(--success)] bg-[var(--success)]/10"
                      : "text-[var(--warning)] bg-[var(--warning)]/10"
                  )}
                >
                  {totalSources >= 2 ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {totalSources} source{totalSources !== 1 ? "s" : ""}
                  {sourcesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>

              <div className={cn("min-h-[80px]", contentExpanded && "min-h-0")}>
                {renderContent(result.rewritten_content, elementKey, true, contentExpanded)}
              </div>

              {result.rewritten_content && result.rewritten_content.length > 150 && (
                <button
                  onClick={() => setContentExpanded(!contentExpanded)}
                  className="mt-1 text-[10px] text-[var(--sensai-teal)] hover:underline"
                >
                  {contentExpanded ? "Show less" : "Show more"}
                </button>
              )}

              {sourcesExpanded && result.sources && result.sources.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
                  {corroboratedSources.map((source) => (
                    <div key={source.source_id} className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-[var(--success)] mt-0.5 shrink-0" />
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--sensai-teal)] hover:underline truncate"
                      >
                        {source.title ?? source.url}
                      </a>
                    </div>
                  ))}
                  {singleSources.map((source) => (
                    <div key={source.source_id} className="flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 text-[var(--warning)] mt-0.5 shrink-0" />
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--warning)] hover:underline truncate"
                      >
                        {source.title ?? source.url}
                        <span className="ml-1 opacity-70">(single source)</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {projectedPoints !== null && maxPoints > 0 && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--success)]"
                    style={{ width: `${(projectedPoints / maxPoints) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
