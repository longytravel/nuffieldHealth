import { getLatestRun, getActionCentreData, getImpactSummary } from "@/db/queries";
import { GlassCard } from "@/components/ui/glass-card";
import { PageTransition } from "@/components/ui/page-transition";
import { ActionsTable } from "./actions-table";

export default async function ActionsPage() {
  const run = await getLatestRun();

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-2xl font-semibold">No Data Available</h1>
        <p className="text-[var(--text-muted)]">
          No completed scrape runs found. Run the scraper to populate data.
        </p>
      </div>
    );
  }

  const actions = getActionCentreData(run.run_id);
  const impact = getImpactSummary(run.run_id);

  const scoreDelta = impact.projectedAvgScore - impact.currentAvgScore;
  const goldDelta = impact.projectedGoldPct - impact.currentGoldPct;

  return (
    <PageTransition className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">Action Centre</h1>
        <p className="text-body text-[var(--text-secondary)]">
          Prioritized improvements to maximize profile quality across{" "}
          {impact.totalProfiles.toLocaleString()} profiles
        </p>
      </div>

      {/* Impact Summary Panel */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <p className="text-caption uppercase text-[var(--text-muted)]">
            Current Avg Score
          </p>
          <p className="text-kpi text-[var(--text-primary)]">
            {impact.currentAvgScore}
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-caption uppercase text-[var(--text-muted)]">
            Projected Avg Score
          </p>
          <p className="text-kpi text-[var(--success)]">
            {impact.projectedAvgScore}
          </p>
          <p className="mt-1 text-caption text-[var(--success)]">
            +{scoreDelta.toFixed(1)} points
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-caption uppercase text-[var(--text-muted)]">
            Current Gold %
          </p>
          <p className="text-kpi text-[var(--tier-gold)]">
            {impact.currentGoldPct}%
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-caption uppercase text-[var(--text-muted)]">
            Projected Gold %
          </p>
          <p className="text-kpi text-[var(--success)]">
            {impact.projectedGoldPct}%
          </p>
          <p className="mt-1 text-caption text-[var(--success)]">
            +{goldDelta.toFixed(1)}%
          </p>
        </GlassCard>
      </div>

      {/* Impact context note */}
      <GlassCard className="border-[var(--info)]/20 py-3">
        <p className="text-caption text-[var(--text-muted)]">
          Projected scores assume all recommended actions are completed.
          Booking state is externally controlled -- no change projected for
          booking-related scores.
        </p>
      </GlassCard>

      {/* Prioritized Actions Table */}
      <ActionsTable actions={actions} />
    </PageTransition>
  );
}
