import Link from "next/link";
import { getLatestRun, getSpecialtyAnalysis } from "@/db/queries";
import { GlassCard } from "@/components/ui/glass-card";
import { TierMiniBar } from "@/components/ui/tier-mini-bar";
import { PageTransition } from "@/components/ui/page-transition";
import { SpecialtyHeatmap } from "./specialty-heatmap";
import { OutlierDetection } from "./outlier-detection";

export default async function SpecialtiesPage() {
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

  const specialties = getSpecialtyAnalysis(run.run_id);

  return (
    <PageTransition className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">
          Specialty Analysis
        </h1>
        <p className="text-body text-[var(--text-secondary)]">
          Profile quality breakdown across {specialties.length} specialties
        </p>
      </div>

      {/* Specialty Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specialties.map((s) => (
          <Link
            key={s.specialty}
            href={`/consultants?specialty=${encodeURIComponent(s.specialty)}`}
          >
            <GlassCard className="h-full cursor-pointer">
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-h3 leading-tight text-[var(--text-primary)]">
                  {s.specialty}
                </h3>
                <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 font-mono text-xs text-[var(--text-accent)]">
                  {s.avgScore}
                </span>
              </div>

              <div className="mb-3 text-caption text-[var(--text-muted)]">
                {s.consultantCount} consultants
              </div>

              <TierMiniBar
                gold={s.goldCount}
                silver={s.silverCount}
                bronze={s.bronzeCount}
                incomplete={s.incompleteCount}
                className="mb-3"
              />

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Photo</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {s.photoPct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Bio</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {s.bioQualityPct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Bookable</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {s.bookablePct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Insurers</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {s.insurerPct}%
                  </span>
                </div>
              </div>

              {s.commonFlags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--border-subtle)] pt-2">
                  {s.commonFlags.map((f) => (
                    <span
                      key={f.code}
                      className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                    >
                      {f.code} ({f.count})
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>
          </Link>
        ))}
      </div>

      {/* Quality Heatmap */}
      <SpecialtyHeatmap specialties={specialties} />

      {/* Outlier Detection */}
      <OutlierDetection specialties={specialties} />
    </PageTransition>
  );
}
