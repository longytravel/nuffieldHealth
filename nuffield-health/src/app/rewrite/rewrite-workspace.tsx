"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wand2, CheckCheck, Download, Search, Loader2, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { TierBadge } from "@/components/ui/tier-badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { BenchmarkBar } from "./benchmark-bar";
import { ElementCard, type ElementStatus } from "./element-card";
import { SourceEvidencePanel } from "./source-evidence-panel";
import { BatchQueue, type BatchItem, type BatchItemStatus } from "./batch-queue";
import type {
  BenchmarkProfile,
  RewritableElementKey,
  RewriteResponse,
  ElementRewriteResult,
  QualityTier,
} from "@/lib/types";

// Spec §13 — rewritable elements
const REWRITABLE_ELEMENTS: { key: RewritableElementKey; label: string; maxPoints: number }[] = [
  { key: "bio", label: "Biography", maxPoints: 25 },
  { key: "treatments", label: "Treatments", maxPoints: 10 },
  { key: "qualifications", label: "Qualifications", maxPoints: 10 },
  { key: "specialty_sub", label: "Sub-specialties", maxPoints: 10 },
  { key: "memberships", label: "Memberships", maxPoints: 5 },
  { key: "practising_since", label: "Practising Since", maxPoints: 5 },
  { key: "clinical_interests", label: "Clinical Interests", maxPoints: 0 },
  { key: "personal_interests", label: "Personal Interests", maxPoints: 0 },
  { key: "photo", label: "Photo", maxPoints: 10 },
];

interface Consultant {
  slug: string;
  consultant_name: string | null;
  specialty_primary: string[];
  hospital_name_primary: string | null;
  profile_completeness_score: number | null;
  quality_tier: string | null;
  about_text?: string | null;
  treatments: string[];
  qualifications_credentials: string | null;
  specialty_sub: string[];
  memberships: string[];
  practising_since: number | null;
  clinical_interests: string[];
  personal_interests: string | null;
  has_photo: boolean | null;
}

interface RewriteWorkspaceProps {
  runId: string;
  consultant: Consultant | null;
  benchmarks: BenchmarkProfile[];
  specialtyBenchmarks: BenchmarkProfile[];
  initialElement: string | null;
  batchSlugs: string[];
}

function getConsultantCurrentContent(
  consultant: Consultant,
  key: RewritableElementKey
): string | null {
  switch (key) {
    case "bio": return consultant.about_text ?? null;
    case "treatments": return consultant.treatments.length > 0 ? JSON.stringify(consultant.treatments) : null;
    case "qualifications": return consultant.qualifications_credentials;
    case "specialty_sub": return consultant.specialty_sub.length > 0 ? JSON.stringify(consultant.specialty_sub) : null;
    case "memberships": return consultant.memberships.length > 0 ? JSON.stringify(consultant.memberships) : null;
    case "practising_since": return consultant.practising_since != null ? String(consultant.practising_since) : null;
    case "clinical_interests": return consultant.clinical_interests.length > 0 ? JSON.stringify(consultant.clinical_interests) : null;
    case "personal_interests": return consultant.personal_interests;
    case "photo": return consultant.has_photo ? "Photo present" : null;
    default: return null;
  }
}

function getConsultantCurrentPoints(consultant: Consultant, key: RewritableElementKey): number {
  switch (key) {
    case "bio": {
      const text = consultant.about_text;
      if (!text) return 0;
      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount >= 150) return 15;
      if (wordCount >= 50) return 8;
      return 3;
    }
    case "treatments": return consultant.treatments.length >= 5 ? 10 : consultant.treatments.length > 0 ? 5 : 0;
    case "qualifications": return consultant.qualifications_credentials ? 10 : 0;
    case "specialty_sub": return consultant.specialty_sub.length > 0 ? 5 : 0;
    case "memberships": return consultant.memberships.length > 0 ? 5 : 0;
    case "practising_since": return consultant.practising_since != null ? 5 : 0;
    case "clinical_interests": return 0;
    case "personal_interests": return 0;
    case "photo": return consultant.has_photo ? 10 : 0;
    default: return 0;
  }
}

export function RewriteWorkspace({
  runId,
  consultant,
  benchmarks,
  specialtyBenchmarks,
  initialElement,
  batchSlugs,
}: RewriteWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Consultant search (when none pre-loaded)
  const [searchQuery, setSearchQuery] = useState("");

  // Element checkboxes
  const [checkedElements, setCheckedElements] = useState<Set<RewritableElementKey>>(
    new Set(
      REWRITABLE_ELEMENTS
        .filter((e) => {
          if (!consultant) return false;
          const content = getConsultantCurrentContent(consultant, e.key);
          const currentPoints = getConsultantCurrentPoints(consultant, e.key);
          // Auto-check elements that are missing AND have points to gain,
          // OR elements that have room for improvement (below max points)
          return (content === null && e.maxPoints > 0) || (e.maxPoints > 0 && currentPoints < e.maxPoints);
        })
        .map((e) => e.key)
    )
  );

  // Selected element for evidence panel
  const [selectedElement, setSelectedElement] = useState<RewritableElementKey | null>(
    initialElement as RewritableElementKey | null
  );

  // Rewrite state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rewriteId, setRewriteId] = useState<string | null>(null);
  const [rewriteResponse, setRewriteResponse] = useState<RewriteResponse | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [elementStatuses, setElementStatuses] = useState<Record<string, ElementStatus>>({});

  // Batch state
  const [batchItems, setBatchItems] = useState<BatchItem[]>(
    batchSlugs.map((slug) => ({ slug, name: slug, status: "pending" as BatchItemStatus }))
  );
  const [batchConfirmed, setBatchConfirmed] = useState(batchSlugs.length <= 5);
  const [showBatchWarning, setShowBatchWarning] = useState(batchSlugs.length > 5);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for rewrite status
  const startPolling = useCallback((id: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/rewrite/${id}`);
        if (!res.ok) return;
        const data: RewriteResponse = await res.json();
        setRewriteResponse(data);

        // Update element statuses
        const newStatuses: Record<string, ElementStatus> = {};
        for (const [key, result] of Object.entries(data.elements)) {
          const r = result as ElementRewriteResult;
          if (r.status === "complete") {
            newStatuses[key] = r.rewritten_content ? "complete" : "insufficient_sources";
          } else if (r.status === "error") {
            newStatuses[key] = "no_data";
          } else if (r.status === "searching" || r.status === "fetching" || r.status === "extracting" || r.status === "corroborating" || r.status === "generating" || r.status === "scoring" || r.status === "storing") {
            newStatuses[key] = "researching";
          }
        }
        setElementStatuses(newStatuses);

        // Update progress text
        if (data.progress) {
          const stage = data.progress.current_stage;
          const stageLabels: Record<string, string> = {
            searching: "Searching for sources",
            fetching: "Fetching pages",
            extracting: `Extracting facts from ${data.progress.sources_found} sources`,
            corroborating: `Corroborating ${data.progress.facts_extracted} facts`,
            generating: "Generating rewritten content",
            scoring: "Computing projected scores",
            storing: "Saving results",
            complete: "Complete",
          };
          setProgressText(stageLabels[stage] ?? stage);
        }

        if (data.status === "complete" || data.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsRunning(false);
          setProgressText(data.status === "complete" ? "Complete" : "Error — check results");
        }
      } catch {
        // polling errors are non-fatal
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function handleRewriteAndResearch() {
    if (!consultant) return;
    setIsRunning(true);
    setProgressText("Queuing research pipeline...");
    setRewriteResponse(null);
    setElementStatuses(
      Object.fromEntries([...checkedElements].map((k) => [k, "researching" as ElementStatus]))
    );

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: consultant.slug,
          run_id: runId,
          elements: [...checkedElements],
          mode: "full",
        }),
      });
      if (!res.ok) throw new Error("Failed to start rewrite");
      const data: { rewrite_id: string; status: string } = await res.json();
      setRewriteId(data.rewrite_id);
      startPolling(data.rewrite_id);
    } catch {
      setIsRunning(false);
      setProgressText("Failed to start rewrite. Please try again.");
    }
  }

  async function handleAcceptAll() {
    if (!rewriteId) return;
    const acceptedElements = Object.entries(rewriteResponse?.elements ?? {})
      .filter(([, r]) => (r as ElementRewriteResult).rewritten_content != null)
      .map(([k]) => k);

    await fetch(`/api/rewrite/${rewriteId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", elements: acceptedElements }),
    });
  }

  function handleBatchConfirm() {
    setBatchConfirmed(true);
    setShowBatchWarning(false);
  }

  const currentSpecialty = consultant?.specialty_primary?.[0] ?? null;
  const selectedElementConfig = REWRITABLE_ELEMENTS.find((e) => e.key === selectedElement) ?? null;
  const selectedResult = selectedElement && rewriteResponse?.elements[selectedElement]
    ? rewriteResponse.elements[selectedElement] ?? null
    : null;

  const hasAnyResults = rewriteResponse != null && Object.values(rewriteResponse.elements).some(
    (r) => (r as ElementRewriteResult).rewritten_content != null
  );

  return (
    <div className="space-y-6">
      {/* Batch warning dialog */}
      {showBatchWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-[var(--warning)] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-h3 text-[var(--text-primary)] mb-2">Large Batch Rewrite</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  You are about to research and rewrite <strong>{batchSlugs.length}</strong> profiles.
                  This will make approximately <strong>{batchSlugs.length * 15}</strong> API calls and
                  may take several minutes. Continue?
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchConfirm}
                className="px-4 py-2 text-sm font-medium bg-[var(--sensai-teal)] text-[var(--bg-primary)] rounded-lg hover:bg-[var(--sensai-teal-dark)] transition-colors"
              >
                Continue
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Batch queue panel */}
      {batchSlugs.length > 0 && batchConfirmed && (
        <BatchQueue
          items={batchItems}
          isPaused={isPaused}
          onPause={() => setIsPaused(true)}
          onResume={() => setIsPaused(false)}
          onCancel={() => {
            setIsPaused(true);
            setBatchItems((prev) =>
              prev.map((item) =>
                item.status === "pending" ? { ...item, status: "failed" } : item
              )
            );
          }}
        />
      )}

      {/* Zone A: Benchmark Bar */}
      <GlassCard>
        <BenchmarkBar
          benchmarks={benchmarks}
          specialtyBenchmarks={specialtyBenchmarks}
          currentSlug={consultant?.slug ?? null}
          currentScore={consultant?.profile_completeness_score ?? null}
          projectedScore={rewriteResponse?.projected_total_score ?? null}
          currentSpecialty={currentSpecialty}
        />
      </GlassCard>

      {/* Zone B: Main workspace */}
      {!consultant ? (
        /* No consultant — show search input */
        <GlassCard className="flex flex-col items-center justify-center py-16 gap-4">
          <Wand2 className="h-12 w-12 text-[var(--text-muted)]" />
          <h2 className="text-h2 text-[var(--text-primary)]">Profile Rewrite Engine</h2>
          <p className="text-sm text-[var(--text-secondary)] text-center max-w-md">
            Navigate to a consultant profile and click "Improve" to start a rewrite, or enter a
            consultant slug below.
          </p>
          <div className="flex w-full max-w-sm gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/rewrite?slug=${searchQuery.trim()}`);
                  }
                }}
                placeholder="Enter consultant slug..."
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-10 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--sensai-teal)] focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => { if (searchQuery.trim()) router.push(`/rewrite?slug=${searchQuery.trim()}`); }}
              className="px-4 py-2 text-sm font-medium bg-[var(--sensai-teal)] text-[var(--bg-primary)] rounded-lg hover:bg-[var(--sensai-teal-dark)] transition-colors"
            >
              Load
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {/* Consultant header + action buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-h2 text-[var(--text-primary)]">
                  {consultant.consultant_name ?? consultant.slug}
                </h2>
                {consultant.quality_tier && (
                  <TierBadge
                    tier={consultant.quality_tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"}
                  />
                )}
                {consultant.profile_completeness_score != null && (
                  <span className="text-sm text-[var(--text-muted)] font-mono">
                    Score: {Math.round(consultant.profile_completeness_score)}
                  </span>
                )}
                {rewriteResponse?.projected_total_score != null && (
                  <span className="text-sm text-[var(--success)] font-mono">
                    → Projected: {Math.round(rewriteResponse.projected_total_score)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)]">
                {consultant.specialty_primary[0] && <span>{consultant.specialty_primary[0]}</span>}
                {consultant.hospital_name_primary && (
                  <>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span>{consultant.hospital_name_primary}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {hasAnyResults && (
                <>
                  <button
                    onClick={handleAcceptAll}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success)]/10 transition-colors"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Accept All
                  </button>
                  <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
                    <Download className="h-4 w-4" />
                    Export Comparison
                  </button>
                </>
              )}
              <button
                onClick={handleRewriteAndResearch}
                disabled={isRunning || checkedElements.size === 0}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-[var(--sensai-teal)] text-[var(--bg-primary)] hover:bg-[var(--sensai-teal-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {isRunning ? "Researching..." : "Research & Rewrite"}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {(isRunning || progressText) && (
            <div className="rounded-xl border border-[var(--sensai-teal)]/20 bg-[var(--sensai-teal)]/5 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-[var(--sensai-teal)]" />}
                <span className="text-sm text-[var(--text-primary)]">{progressText}</span>
              </div>
              {rewriteResponse?.progress && (
                <div className="text-xs text-[var(--text-muted)] space-x-3">
                  <span>{rewriteResponse.progress.sources_found} sources found</span>
                  <span>·</span>
                  <span>{rewriteResponse.progress.facts_extracted} facts extracted</span>
                </div>
              )}
            </div>
          )}

          {/* Search error warning banner */}
          {!isRunning && rewriteResponse?.progress && rewriteResponse.progress.sources_found === 0 && rewriteResponse.progress.search_errors && rewriteResponse.progress.search_errors.length > 0 && (
            <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--warning)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Search failed</p>
                  {rewriteResponse.progress.search_errors.map((err, i) => (
                    <p key={i} className="text-xs text-[var(--text-secondary)]">{err}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-2 gap-0">
            <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Current Profile
            </div>
            <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Proposed Rewrite
            </div>
          </div>

          {/* Element cards */}
          <div className="space-y-3">
            {REWRITABLE_ELEMENTS.map((element) => {
              const currentContent = getConsultantCurrentContent(consultant, element.key);
              const currentPoints = getConsultantCurrentPoints(consultant, element.key);
              const status: ElementStatus = elementStatuses[element.key] ?? "not_started";
              const result = rewriteResponse?.elements[element.key] ?? null;

              return (
                <ElementCard
                  key={element.key}
                  elementKey={element.key}
                  label={element.label}
                  maxPoints={element.maxPoints}
                  currentPoints={currentPoints}
                  currentContent={currentContent}
                  checked={checkedElements.has(element.key)}
                  onCheckChange={(checked) => {
                    setCheckedElements((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(element.key);
                      else next.delete(element.key);
                      return next;
                    });
                  }}
                  status={status}
                  result={result as ElementRewriteResult | null}
                  isSelected={selectedElement === element.key}
                  onSelect={() => setSelectedElement(element.key)}
                />
              );
            })}
          </div>

          {/* Projected score summary */}
          {rewriteResponse?.projected_total_score != null && (
            <GlassCard className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Projected Score</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                    {Math.round(consultant.profile_completeness_score ?? 0)}
                  </span>
                  <span className="text-lg text-[var(--text-muted)]">→</span>
                  <span className="text-2xl font-bold font-mono text-[var(--success)]">
                    {Math.round(rewriteResponse.projected_total_score)}
                  </span>
                  <span className="text-sm text-[var(--success)]">
                    (+{Math.round(rewriteResponse.projected_total_score - (consultant.profile_completeness_score ?? 0))})
                  </span>
                </div>
              </div>
              {rewriteResponse.projected_tier && (
                <div className="flex flex-col items-end gap-1">
                  <p className="text-xs text-[var(--text-muted)]">Projected Tier</p>
                  <TierBadge
                    tier={rewriteResponse.projected_tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"}
                    className="text-sm px-3 py-1"
                  />
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}

      {/* Zone C: Source Evidence Panel */}
      <SourceEvidencePanel
        elementKey={selectedElement}
        elementLabel={selectedElementConfig?.label ?? null}
        result={selectedResult as ElementRewriteResult | null}
      />
    </div>
  );
}
