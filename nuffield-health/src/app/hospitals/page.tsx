import Link from "next/link";
import { getLatestRun, getHospitalBenchmarks } from "@/db/queries";
import { GlassCard } from "@/components/ui/glass-card";
import { TierMiniBar } from "@/components/ui/tier-mini-bar";
import { PageTransition } from "@/components/ui/page-transition";
import { HospitalComparison } from "./hospital-comparison";
import { HospitalLeaderboard } from "./hospital-leaderboard";

export default async function HospitalsPage() {
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

  const hospitals = getHospitalBenchmarks(run.run_id);

  return (
    <PageTransition className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">
          Hospital Benchmarking
        </h1>
        <p className="text-body text-[var(--text-secondary)]">
          Compare consultant profile quality across {hospitals.length} hospitals
        </p>
      </div>

      {/* Hospital Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hospitals.map((h) => (
          <Link
            key={h.hospitalName}
            href={`/consultants?hospital=${encodeURIComponent(h.hospitalName)}`}
          >
            <GlassCard className="h-full cursor-pointer">
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-h3 leading-tight text-[var(--text-primary)]">
                  {h.hospitalName}
                </h3>
                <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 font-mono text-xs text-[var(--text-accent)]">
                  {h.avgScore}
                </span>
              </div>

              <div className="mb-3 flex items-center gap-3 text-caption text-[var(--text-muted)]">
                <span>{h.consultantCount} consultants</span>
                <span>|</span>
                <span>{h.bookablePct}% bookable</span>
              </div>

              <TierMiniBar
                gold={h.goldCount}
                silver={h.silverCount}
                bronze={h.bronzeCount}
                incomplete={h.incompleteCount}
                className="mb-3"
              />

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Gold</span>
                  <span className="font-mono text-[var(--tier-gold)]">
                    {h.goldPct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Photo</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {h.photoPct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Bio</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {h.bioQualityPct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Insurers</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {h.insurerPct}%
                  </span>
                </div>
              </div>

              {h.topSpecialty && (
                <div className="mt-3 border-t border-[var(--border-subtle)] pt-2 text-caption text-[var(--text-muted)]">
                  Top: {h.topSpecialty}
                </div>
              )}
            </GlassCard>
          </Link>
        ))}
      </div>

      {/* Comparison Mode */}
      <HospitalComparison hospitals={hospitals} />

      {/* Leaderboard Table */}
      <HospitalLeaderboard hospitals={hospitals} />
    </PageTransition>
  );
}
