"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { TierBadge } from "@/components/ui/tier-badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { cn } from "@/lib/utils";
import type { BenchmarkProfile, QualityTier } from "@/lib/types";

interface BenchmarkBarProps {
  benchmarks: BenchmarkProfile[];
  specialtyBenchmarks: BenchmarkProfile[];
  currentSlug: string | null;
  currentScore: number | null;
  projectedScore: number | null;
  currentSpecialty: string | null;
}

export function BenchmarkBar({
  benchmarks,
  specialtyBenchmarks,
  currentSlug,
  currentScore,
  projectedScore,
  currentSpecialty,
}: BenchmarkBarProps) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<"overall" | "specialty">("overall");

  const profiles = mode === "specialty" && specialtyBenchmarks.length > 0
    ? specialtyBenchmarks
    : benchmarks;

  const avgScore = profiles.length > 0
    ? Math.round(profiles.reduce((sum, p) => sum + p.profile_completeness_score, 0) / profiles.length)
    : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-h3 text-[var(--text-primary)]">Benchmark Profiles</h2>
          {currentScore !== null && avgScore !== null && (
            <span className="text-xs text-[var(--text-muted)]">
              This profile: <span className="font-medium text-[var(--text-primary)]">{Math.round(currentScore)}</span>
              {projectedScore !== null && (
                <span className="text-[var(--success)]"> → {Math.round(projectedScore)}</span>
              )}
              {" "}| Top {profiles.length} average:{" "}
              <span className="font-medium text-[var(--text-primary)]">{avgScore}</span>
            </span>
          )}
        </div>

        {/* Toggle */}
        {currentSpecialty && specialtyBenchmarks.length > 0 && (
          <div className="flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            <button
              onClick={() => setMode("overall")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "overall"
                  ? "bg-[var(--sensai-teal)] text-[var(--bg-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              )}
            >
              Top 5 Overall
            </button>
            <button
              onClick={() => setMode("specialty")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors border-l border-[var(--border-subtle)]",
                mode === "specialty"
                  ? "bg-[var(--sensai-teal)] text-[var(--bg-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              )}
            >
              Top 5 in {currentSpecialty}
            </button>
          </div>
        )}
      </div>

      {/* Card strip */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {profiles.map((profile) => (
          <div key={profile.slug} className="flex-shrink-0 w-[200px]">
            <GlassCard
              className={cn(
                "p-3 cursor-pointer transition-all",
                expandedSlug === profile.slug && "border-[var(--sensai-teal)]/50"
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => setExpandedSlug(expandedSlug === profile.slug ? null : profile.slug)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium",
                    profile.has_photo
                      ? "bg-[var(--sensai-teal)]/15 text-[var(--sensai-teal)]"
                      : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                  )}>
                    {(profile.consultant_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {profile.consultant_name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">
                      {profile.specialty_primary[0] ?? "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <ScoreGauge score={Math.round(profile.profile_completeness_score)} size="sm" />
                  <TierBadge
                    tier={profile.quality_tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"}
                  />
                </div>

                <div className="mt-2 flex items-center justify-end text-[10px] text-[var(--text-muted)]">
                  {expandedSlug === profile.slug ? (
                    <span className="flex items-center gap-0.5">
                      Hide <ChevronUp className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      Details <ChevronDown className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </button>
            </GlassCard>

            {/* Expanded breakdown */}
            {expandedSlug === profile.slug && (
              <div className="mt-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2">
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Element Breakdown
                </p>
                <BenchmarkBreakdownItem
                  label="Bio"
                  present={profile.bio_depth != null && profile.bio_depth !== "missing"}
                  detail={profile.bio_depth ?? "Missing"}
                />
                <BenchmarkBreakdownItem
                  label="Treatments"
                  present={profile.treatments_count > 0}
                  detail={profile.treatments_count > 0 ? `${profile.treatments_count} listed` : "None"}
                />
                <BenchmarkBreakdownItem
                  label="Qualifications"
                  present={profile.qualifications_present}
                  detail={profile.qualifications_present ? "Present" : "Missing"}
                />
                <BenchmarkBreakdownItem
                  label="Memberships"
                  present={profile.memberships_count > 0}
                  detail={profile.memberships_count > 0 ? `${profile.memberships_count} listed` : "None"}
                />
                <BenchmarkBreakdownItem
                  label="Photo"
                  present={profile.has_photo === true}
                  detail={profile.has_photo ? "Present" : "Missing"}
                />
                <BenchmarkBreakdownItem
                  label="Practising Since"
                  present={profile.practising_since != null}
                  detail={profile.practising_since != null ? String(profile.practising_since) : "Unknown"}
                />
                {profile.hospital_name_primary && (
                  <p className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                    {profile.hospital_name_primary}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {profiles.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8 text-sm text-[var(--text-muted)]">
            No benchmark profiles available
          </div>
        )}
      </div>
    </div>
  );
}

function BenchmarkBreakdownItem({
  label,
  present,
  detail,
}: {
  label: string;
  present: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        {present ? (
          <CheckCircle className="h-3 w-3 text-[var(--success)] shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-[var(--danger)] shrink-0" />
        )}
        <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[80px]">{detail}</span>
    </div>
  );
}
