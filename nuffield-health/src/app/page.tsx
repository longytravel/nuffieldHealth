import {
  Users,
  TrendingUp,
  Award,
  Calendar,
  AlertTriangle,
  BookOpen,
  Camera,
  PoundSterling,
  Sparkles,
  Zap,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { getLatestRun, getDashboardKPIs, getQualityTierDistribution, getQuickActions, getHospitalLeaderboard } from "@/db/queries";
import { GlassCard } from "@/components/ui/glass-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { TierBadge } from "@/components/ui/tier-badge";
import { TierDonutChart } from "./components/tier-donut-chart";
import { CopyButton } from "./components/copy-button";
import { HospitalLeaderboardRow } from "./components/hospital-leaderboard-row";
import {
  DashboardPageTransition,
  KpiStaggerGrid,
  KpiStaggerItem,
  DashboardSection,
} from "./components/dashboard-animations";

function formatNumber(n: number): string {
  return n.toLocaleString("en-GB");
}

function formatScore(n: number): string {
  return n.toFixed(1);
}

function formatPct(n: number): string {
  return n.toFixed(1) + "%";
}

function formatPrice(n: number | null): string {
  if (n === null) return "N/A";
  return "\u00A3" + n.toFixed(0);
}

const QUICK_ACTION_FILTERS: Record<string, string> = {
  "Add profile photos": "has_photo=false",
  "Write missing biographies": "bio_depth=missing",
  "Expand thin biographies": "bio_depth=thin",
  "Add qualifications and credentials": "score_max=90",
  "List accepted insurers": "score_max=92",
  "Add consultation times": "score_max=93",
};

const TIER_COLORS: Record<string, string> = {
  Gold: "var(--tier-gold)",
  Silver: "var(--tier-silver)",
  Bronze: "var(--tier-bronze)",
  Incomplete: "var(--tier-incomplete)",
};

export default async function DashboardPage() {
  const run = await getLatestRun();

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-h1 text-[var(--text-primary)]">No Data Available</h1>
        <p className="text-body text-[var(--text-secondary)]">
          No completed scrape runs found. Run the scraper to populate data.
        </p>
        <code className="rounded-lg bg-[var(--bg-elevated)] px-4 py-2 text-caption font-mono text-[var(--text-accent)]">
          npx tsx src/scraper/run.ts
        </code>
      </div>
    );
  }

  const [kpis, tierDistribution, quickActions, hospitalLeaderboard] = await Promise.all([
    getDashboardKPIs(run.run_id),
    getQualityTierDistribution(run.run_id),
    getQuickActions(run.run_id),
    getHospitalLeaderboard(run.run_id),
  ]);

  const tierData = tierDistribution.map((t) => ({
    name: t.quality_tier ?? "Unknown",
    value: t.count,
    fill: TIER_COLORS[t.quality_tier ?? ""] ?? "#6B7280",
  }));

  // Build executive summary text
  const topAction = quickActions.length > 0 ? quickActions[0].description.toLowerCase() : null;
  const summaryText = `Your consultant network scores ${formatScore(kpis.avgScore)}/100 overall. ${formatPct(kpis.goldPct)} of profiles are Gold tier. ${formatNumber(kpis.bookableCount)} consultants are bookable online.${topAction ? ` Top priority: ${topAction} (${formatNumber(quickActions[0].profilesAffected)} profiles affected).` : ""}`;

  const runDate = run.completed_at
    ? new Date(run.completed_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "In progress";

  return (
    <DashboardPageTransition>
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">Executive Dashboard</h1>
        <p className="text-body text-[var(--text-secondary)]">
          Network health at a glance &middot; Last run: {runDate}
        </p>
      </div>

      {/* AI Executive Summary */}
      <DashboardSection delay={0.1}>
        <GlassCard className="border-l-2 border-l-[var(--sensai-teal)]">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sensai-teal)]" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-h3 text-[var(--text-primary)]">AI Executive Summary</h2>
                <CopyButton text={summaryText} />
              </div>
              <p className="text-body leading-relaxed text-[var(--text-secondary)]">
                {summaryText}
              </p>
            </div>
          </div>
        </GlassCard>
      </DashboardSection>

      {/* 8 KPI Cards — 2 rows of 4, staggered entrance */}
      <KpiStaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStaggerItem>
          <KpiCard
            icon={Users}
            label="Total Profiles"
            value={formatNumber(kpis.totalProfiles)}
            href="/consultants"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={TrendingUp}
            label="Avg Score"
            value={formatScore(kpis.avgScore) + "/100"}
            href="/consultants?sort_by=score&sort_dir=asc"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={Award}
            label="Gold Tier"
            value={formatPct(kpis.goldPct)}
            href="/consultants?quality_tier=Gold"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={Calendar}
            label="Bookable"
            value={formatNumber(kpis.bookableCount)}
            href="/consultants?booking_state=bookable_with_slots"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={AlertTriangle}
            label="Needs Review"
            value={formatNumber(kpis.needsReview)}
            href="/consultants/review"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={BookOpen}
            label="Avg Plain English"
            value={formatScore(kpis.avgPlainEnglish) + "/5"}
            href="/consultants?sort_by=plain_english&sort_dir=asc"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={Camera}
            label="Missing Photos"
            value={formatNumber(kpis.missingPhotos)}
            href="/consultants?has_photo=false"
          />
        </KpiStaggerItem>
        <KpiStaggerItem>
          <KpiCard
            icon={PoundSterling}
            label="Avg Price"
            value={formatPrice(kpis.avgPrice)}
            href="/consultants?sort_by=price&sort_dir=desc"
          />
        </KpiStaggerItem>
      </KpiStaggerGrid>

      {/* Charts & Actions Row */}
      <DashboardSection delay={0.35} className="grid gap-6 lg:grid-cols-2">
        {/* Tier Distribution Donut */}
        <GlassCard>
          <h2 className="text-h3 mb-4 text-[var(--text-primary)]">Tier Distribution</h2>
          <TierDonutChart data={tierData} total={kpis.totalProfiles} />
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {tierData.map((tier) => (
              <Link
                key={tier.name}
                href={`/consultants?quality_tier=${encodeURIComponent(tier.name)}`}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tier.fill }}
                />
                <span className="text-caption text-[var(--text-secondary)]">
                  {tier.name}: {tier.value.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </GlassCard>

        {/* Quick Actions Panel */}
        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--warning)]" />
            <h2 className="text-h3 text-[var(--text-primary)]">Quick Actions</h2>
          </div>
          {quickActions.length === 0 ? (
            <p className="text-body text-[var(--text-muted)]">No improvement actions identified.</p>
          ) : (
            <div className="space-y-3">
              {quickActions.map((action, i) => {
                const filterParam = QUICK_ACTION_FILTERS[action.description] ?? "";
                const href = filterParam ? `/consultants?${filterParam}` : "/consultants";
                return (
                  <Link
                    key={i}
                    href={href}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 transition-colors hover:border-[var(--border-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-[var(--text-primary)]">
                        {action.description}
                      </p>
                      <p className="text-caption text-[var(--text-muted)]">
                        {formatNumber(action.profilesAffected)} profiles &middot; +{action.potentialUplift} pts each
                      </p>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <span className="text-body font-semibold text-[var(--sensai-teal)]">
                        +{formatNumber(action.totalImpact)}
                      </span>
                      <p className="text-caption text-[var(--text-muted)]">total pts</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>
      </DashboardSection>

      {/* Hospital Leaderboard */}
      <DashboardSection delay={0.5}>
        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[var(--tier-gold)]" />
            <h2 className="text-h3 text-[var(--text-primary)]">Hospital Leaderboard</h2>
            <span className="text-caption text-[var(--text-muted)]">Top 10 by avg score</span>
          </div>
          {hospitalLeaderboard.length === 0 ? (
            <p className="text-body text-[var(--text-muted)]">No hospital data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" aria-label="Hospital leaderboard ranked by average score">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-caption py-3 pr-4 font-medium text-[var(--text-muted)]">#</th>
                    <th className="text-caption py-3 pr-4 font-medium text-[var(--text-muted)]">Hospital</th>
                    <th className="text-caption py-3 pr-4 text-right font-medium text-[var(--text-muted)]">Consultants</th>
                    <th className="text-caption py-3 pr-4 text-right font-medium text-[var(--text-muted)]">Avg Score</th>
                    <th className="text-caption py-3 font-medium text-[var(--text-muted)]">Tier Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitalLeaderboard.map((hospital, i) => {
                    const total = hospital.goldCount + hospital.silverCount + hospital.bronzeCount + hospital.incompleteCount;
                    const hospitalHref = `/consultants?hospital=${encodeURIComponent(hospital.hospitalName)}`;
                    return (
                      <HospitalLeaderboardRow
                        key={hospital.hospitalName}
                        href={hospitalHref}
                      >
                        <td className="py-3 pr-4 text-body text-[var(--text-muted)]">{i + 1}</td>
                        <td className="py-3 pr-4 text-body font-medium text-[var(--text-primary)] hover:text-[var(--sensai-teal)]">
                          {hospital.hospitalName}
                        </td>
                        <td className="py-3 pr-4 text-right text-body text-[var(--text-secondary)]">
                          {formatNumber(hospital.consultantCount)}
                        </td>
                        <td className="py-3 pr-4 text-right text-body font-semibold text-[var(--text-primary)]">
                          {formatScore(hospital.avgScore)}
                        </td>
                        <td className="py-3">
                          {total > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-2 w-full max-w-[160px] overflow-hidden rounded-full">
                                {hospital.goldCount > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(hospital.goldCount / total) * 100}%`,
                                      backgroundColor: "var(--tier-gold)",
                                    }}
                                  />
                                )}
                                {hospital.silverCount > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(hospital.silverCount / total) * 100}%`,
                                      backgroundColor: "var(--tier-silver)",
                                    }}
                                  />
                                )}
                                {hospital.bronzeCount > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(hospital.bronzeCount / total) * 100}%`,
                                      backgroundColor: "var(--tier-bronze)",
                                    }}
                                  />
                                )}
                                {hospital.incompleteCount > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(hospital.incompleteCount / total) * 100}%`,
                                      backgroundColor: "var(--tier-incomplete)",
                                    }}
                                  />
                                )}
                              </div>
                              <div className="flex shrink-0 gap-1">
                                {hospital.goldCount > 0 && (
                                  <TierBadge tier="gold" />
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-caption text-[var(--text-muted)]">--</span>
                          )}
                        </td>
                      </HospitalLeaderboardRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </DashboardSection>
    </DashboardPageTransition>
  );
}
