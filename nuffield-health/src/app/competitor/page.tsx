export const dynamic = "force-dynamic";

import {
  Swords,
  TrendingUp,
  TrendingDown,
  Equal,
  Link2,
  ArrowUpRight,
  Camera,
  FileText,
  Stethoscope,
  GraduationCap,
  Languages,
  Award,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { getLatestRun } from "@/db/queries";
import {
  getLatestBupaRun,
  getBupaRunById,
  getAggregateComparison,
  getTopGaps,
  getAllMatchedPairs,
} from "@/db/bupa-queries";
import { GlassCard } from "@/components/ui/glass-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { TierBadge } from "@/components/ui/tier-badge";
import type { QualityTier } from "@/lib/types";

function formatPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function formatScore(n: number | null): string {
  if (n === null) return "N/A";
  return n.toFixed(1);
}

const TIER_ORDER: QualityTier[] = ["Gold", "Silver", "Bronze", "Incomplete"];

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  photo: <Camera className="h-4 w-4" />,
  bio_depth: <FileText className="h-4 w-4" />,
  treatments: <Stethoscope className="h-4 w-4" />,
  qualifications: <GraduationCap className="h-4 w-4" />,
  specialties: <Sparkles className="h-4 w-4" />,
  plain_english: <Languages className="h-4 w-4" />,
  memberships: <Award className="h-4 w-4" />,
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function str(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = params[key];
  return typeof v === "string" ? v : undefined;
}

export default async function CompetitorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedBupaRunId = str(params, "bupaRunId");

  const [nuffieldRun, bupaRun] = await Promise.all([
    getLatestRun(),
    requestedBupaRunId ? getBupaRunById(requestedBupaRunId) : getLatestBupaRun(true),
  ]);

  if (!nuffieldRun || !bupaRun) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Competitive Intelligence</h1>
          <p className="text-body text-[var(--text-secondary)] mt-1">
            BUPA vs Nuffield profile comparison
          </p>
        </div>
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <Swords className="h-12 w-12 text-[var(--text-muted)] mb-4" />
          <h3 className="text-h3 text-[var(--text-primary)] mb-2">No Competitor Data Available</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-md">
            {!nuffieldRun
              ? "Run the Nuffield scraper first to generate baseline data."
              : "Run the BUPA scraper to generate competitor data for comparison."}
          </p>
          <pre className="mt-4 rounded-lg bg-[var(--bg-secondary)] px-4 py-2 text-xs text-[var(--text-muted)] font-mono">
            npx tsx src/scraper/bupa/run-bupa.ts --limit 50
          </pre>
        </GlassCard>
      </div>
    );
  }

  const [comparison, topGaps, allPairs] = await Promise.all([
    getAggregateComparison(nuffieldRun.run_id, bupaRun.run_id),
    getTopGaps(nuffieldRun.run_id, bupaRun.run_id, 20),
    getAllMatchedPairs(nuffieldRun.run_id, bupaRun.run_id),
  ]);

  const totalCompared = comparison.bupa_better_count + comparison.nuffield_better_count + comparison.tie_count;
  const bupaBetterPct = totalCompared > 0 ? (comparison.bupa_better_count / totalCompared) * 100 : 0;
  const nuffieldBetterPct = totalCompared > 0 ? (comparison.nuffield_better_count / totalCompared) * 100 : 0;
  const profileHref = (slug: string) =>
    requestedBupaRunId ? `/consultants/${slug}?bupaRunId=${encodeURIComponent(bupaRun.run_id)}` : `/consultants/${slug}`;
  const runLabel = bupaRun.run_id.startsWith("pilot-")
    ? `Pilot run: ${comparison.matched_count}/${comparison.total_nuffield} surfaced consultants`
    : `${comparison.matched_count} matched consultants`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">Competitive Intelligence</h1>
        <p className="text-body text-[var(--text-secondary)] mt-1">
          BUPA vs Nuffield profile comparison &mdash; {runLabel}
        </p>
        {requestedBupaRunId && (
          <p className="mt-2 text-xs font-mono text-[var(--text-muted)]">
            run_id={bupaRun.run_id}
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Link2}
          label="Match Rate"
          value={formatPct(comparison.match_rate)}
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg Score (Nuffield)"
          value={formatScore(comparison.nuffield_avg_adjusted)}
        />
        <KpiCard
          icon={TrendingDown}
          label="Avg Score (BUPA)"
          value={formatScore(comparison.bupa_avg_adjusted)}
        />
        <KpiCard
          icon={Swords}
          label="BUPA Better"
          value={`${comparison.bupa_better_count} (${formatPct(bupaBetterPct)})`}
        />
      </div>

      {/* Middle Row: Tier Comparison + Win/Loss */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tier Distribution Comparison */}
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-6">Tier Distribution</h3>
          <div className="space-y-4">
            {TIER_ORDER.map((tier) => {
              const nCount = comparison.nuffield_tiers[tier] ?? 0;
              const bCount = comparison.bupa_tiers[tier] ?? 0;
              const maxCount = Math.max(nCount, bCount, 1);

              return (
                <div key={tier} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <TierBadge tier={tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"} />
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      N:{nCount} / B:{bCount}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 h-3 rounded-l-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-l-full bg-[var(--sensai-teal)]"
                        style={{ width: `${(nCount / maxCount) * 100}%` }}
                      />
                    </div>
                    <div className="flex-1 h-3 rounded-r-full bg-[var(--bg-elevated)] overflow-hidden flex justify-end">
                      <div
                        className="h-full rounded-r-full bg-[var(--warning)]"
                        style={{ width: `${(bCount / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-2">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--sensai-teal)]" /> Nuffield
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)]" /> BUPA
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Win/Loss Summary */}
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-6">Win / Loss / Tie</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-kpi text-[var(--success)]">{comparison.nuffield_better_count}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Nuffield Wins</p>
              </div>
              <div>
                <p className="text-kpi text-[var(--text-muted)]">{comparison.tie_count}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Ties</p>
              </div>
              <div>
                <p className="text-kpi text-[var(--danger)]">{comparison.bupa_better_count}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">BUPA Wins</p>
              </div>
            </div>

            {/* Stacked bar */}
            {totalCompared > 0 && (
              <div className="h-6 flex rounded-full overflow-hidden">
                <div
                  className="bg-[var(--success)] transition-all"
                  style={{ width: `${nuffieldBetterPct}%` }}
                  title={`Nuffield: ${comparison.nuffield_better_count}`}
                />
                <div
                  className="bg-[var(--bg-elevated)] transition-all"
                  style={{ width: `${100 - nuffieldBetterPct - bupaBetterPct}%` }}
                  title={`Tie: ${comparison.tie_count}`}
                />
                <div
                  className="bg-[var(--danger)] transition-all"
                  style={{ width: `${bupaBetterPct}%` }}
                  title={`BUPA: ${comparison.bupa_better_count}`}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Nuffield Avg (adjusted)</p>
                <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {formatScore(comparison.nuffield_avg_adjusted)}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
                <p className="text-xs text-[var(--text-muted)]">BUPA Avg (adjusted)</p>
                <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {formatScore(comparison.bupa_avg_adjusted)}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Dimension Heatmap */}
      {comparison.dimension_wins.length > 0 && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-6">Dimension Breakdown</h3>
          <div className="space-y-3">
            {comparison.dimension_wins.map((dim) => {
              const total = dim.bupa_wins + dim.nuffield_wins + dim.ties;
              if (total === 0) return null;
              const bupaW = (dim.bupa_wins / total) * 100;
              const nuffW = (dim.nuffield_wins / total) * 100;

              return (
                <div key={dim.dimension} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                      {DIMENSION_ICONS[dim.dimension] ?? <Equal className="h-4 w-4" />}
                      {dim.label}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      N:{dim.nuffield_wins} / T:{dim.ties} / B:{dim.bupa_wins}
                    </span>
                  </div>
                  <div className="h-2.5 flex rounded-full overflow-hidden bg-[var(--bg-elevated)]">
                    <div
                      className="bg-[var(--success)]"
                      style={{ width: `${nuffW}%` }}
                    />
                    <div style={{ width: `${100 - nuffW - bupaW}%` }} />
                    <div
                      className="bg-[var(--danger)]"
                      style={{ width: `${bupaW}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* All Matched Consultants Table */}
      {allPairs.length > 0 && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-4">
            All Matched Consultants ({allPairs.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="pb-3 text-left text-xs font-medium text-[var(--text-muted)]">Consultant</th>
                  <th className="pb-3 text-left text-xs font-medium text-[var(--text-muted)]">Specialty</th>
                  <th className="pb-3 text-right text-xs font-medium text-[var(--text-muted)]">Nuffield</th>
                  <th className="pb-3 text-center text-xs font-medium text-[var(--text-muted)]">N Tier</th>
                  <th className="pb-3 text-right text-xs font-medium text-[var(--text-muted)]">BUPA</th>
                  <th className="pb-3 text-center text-xs font-medium text-[var(--text-muted)]">B Tier</th>
                  <th className="pb-3 text-right text-xs font-medium text-[var(--text-muted)]">Delta</th>
                  <th className="pb-3 text-right text-xs font-medium text-[var(--text-muted)]">Links</th>
                </tr>
              </thead>
              <tbody>
                {allPairs.map((pair) => {
                  const deltaColor =
                    pair.winner === "bupa"
                      ? "text-[var(--danger)]"
                      : pair.winner === "nuffield"
                        ? "text-[var(--success)]"
                        : "text-[var(--text-muted)]";
                  const DeltaIcon =
                    pair.winner === "bupa"
                      ? TrendingDown
                      : pair.winner === "nuffield"
                        ? TrendingUp
                        : Equal;

                  return (
                    <tr key={pair.nuffield_slug} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-elevated)]/30">
                      <td className="py-2.5">
                        <Link
                          href={profileHref(pair.nuffield_slug)}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--sensai-teal)] transition-colors"
                        >
                          {pair.consultant_name ?? pair.nuffield_slug}
                        </Link>
                      </td>
                      <td className="py-2.5 text-[var(--text-secondary)] max-w-[180px] truncate">
                        {pair.specialty_primary.slice(0, 2).join(", ") || "N/A"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {pair.nuffield_adjusted.toFixed(1)}
                      </td>
                      <td className="py-2.5 text-center">
                        <TierBadge tier={(pair.nuffield_tier ?? "Incomplete").toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"} />
                      </td>
                      <td className="py-2.5 text-right font-mono text-[var(--warning)]">
                        {pair.bupa_adjusted.toFixed(1)}
                      </td>
                      <td className="py-2.5 text-center">
                        <TierBadge tier={(pair.bupa_tier ?? "Incomplete").toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"} />
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${deltaColor}`}>
                          <DeltaIcon className="h-3 w-3" />
                          {pair.delta > 0 ? "+" : ""}{pair.delta.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={profileHref(pair.nuffield_slug)}
                            className="text-xs text-[var(--sensai-teal)] hover:underline"
                          >
                            Profile
                          </Link>
                          {pair.bupa_profile_url && (
                            <a
                              href={pair.bupa_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              BUPA <ArrowUpRight className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Run Info */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>Nuffield run: {nuffieldRun.run_id.slice(0, 8)}...</span>
        <span>BUPA run: {bupaRun.run_id.slice(0, 8)}...</span>
        <span>Matched: {comparison.matched_count} / {comparison.total_nuffield}</span>
      </div>
    </div>
  );
}
