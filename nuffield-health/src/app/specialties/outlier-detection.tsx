import { GlassCard } from "@/components/ui/glass-card";
import type { SpecialtyBenchmark } from "@/db/queries";

interface OutlierDetectionProps {
  specialties: SpecialtyBenchmark[];
}

interface Outlier {
  specialty: string;
  dimension: string;
  value: number;
  globalAvg: number;
  zScore: number;
  direction: "above" | "below";
  message: string;
}

const OUTLIER_DIMENSIONS: {
  key: keyof SpecialtyBenchmark;
  label: string;
  unit: string;
  higherIsBetter: boolean;
}[] = [
  { key: "photoPct", label: "Photo coverage", unit: "%", higherIsBetter: true },
  { key: "bioQualityPct", label: "Bio quality", unit: "%", higherIsBetter: true },
  { key: "avgScore", label: "Average score", unit: "", higherIsBetter: true },
  { key: "bookablePct", label: "Bookable rate", unit: "%", higherIsBetter: true },
  { key: "insurerPct", label: "Insurer coverage", unit: "%", higherIsBetter: true },
  { key: "avgPlainEnglish", label: "Plain English score", unit: "/10", higherIsBetter: true },
];

function computeOutliers(specialties: SpecialtyBenchmark[]): Outlier[] {
  // Only consider specialties with >= 5 consultants for outlier detection
  const eligible = specialties.filter((s) => s.consultantCount >= 5);
  if (eligible.length < 3) return [];

  const outliers: Outlier[] = [];

  for (const dim of OUTLIER_DIMENSIONS) {
    const values = eligible.map((s) => s[dim.key] as number);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) continue;

    for (const spec of eligible) {
      const val = spec[dim.key] as number;
      const zScore = (val - mean) / stddev;

      if (Math.abs(zScore) > 1.5) {
        const direction = zScore > 0 ? "above" : "below";
        const isGood = dim.higherIsBetter ? direction === "above" : direction === "below";

        const message = isGood
          ? `${spec.specialty} has ${dim.label.toLowerCase()} of ${val}${dim.unit} -- significantly above average (${mean.toFixed(1)}${dim.unit})`
          : `${spec.specialty} has ${dim.label.toLowerCase()} of ${val}${dim.unit} -- significantly below average (${mean.toFixed(1)}${dim.unit})`;

        outliers.push({
          specialty: spec.specialty,
          dimension: dim.label,
          value: val,
          globalAvg: Math.round(mean * 10) / 10,
          zScore: Math.round(zScore * 100) / 100,
          direction,
          message,
        });
      }
    }
  }

  // Sort by absolute z-score descending
  outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  return outliers;
}

export function OutlierDetection({ specialties }: OutlierDetectionProps) {
  const outliers = computeOutliers(specialties);

  if (outliers.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-h2 text-[var(--text-primary)]">
          Outlier Detection
        </h2>
        <GlassCard className="py-8 text-center text-[var(--text-muted)]">
          No significant outliers detected across specialties.
        </GlassCard>
      </div>
    );
  }

  // Group: negative outliers (warnings) vs positive outliers (good)
  const warnings = outliers.filter(
    (o) =>
      (OUTLIER_DIMENSIONS.find((d) => d.label === o.dimension)?.higherIsBetter && o.direction === "below") ||
      (!OUTLIER_DIMENSIONS.find((d) => d.label === o.dimension)?.higherIsBetter && o.direction === "above")
  );
  const positives = outliers.filter((o) => !warnings.includes(o));

  return (
    <div className="space-y-4">
      <h2 className="text-h2 text-[var(--text-primary)]">
        Outlier Detection
      </h2>
      <p className="text-caption text-[var(--text-muted)]">
        Specialties with z-score &gt; 1.5 standard deviations from the mean.
        Only specialties with 5+ consultants are analyzed.
      </p>

      {warnings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-h3 text-[var(--danger)]">Needs Attention</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {warnings.slice(0, 9).map((o, i) => (
              <GlassCard
                key={`${o.specialty}-${o.dimension}-${i}`}
                className="border-[var(--danger)]/30"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--danger)]" />
                  <span className="text-xs font-medium uppercase text-[var(--danger)]">
                    {o.dimension}
                  </span>
                </div>
                <p className="text-body text-[var(--text-primary)]">
                  {o.message}
                </p>
                <p className="mt-1 font-mono text-caption text-[var(--text-muted)]">
                  z = {o.zScore}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {positives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-h3 text-[var(--success)]">Strong Performers</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {positives.slice(0, 6).map((o, i) => (
              <GlassCard
                key={`${o.specialty}-${o.dimension}-${i}`}
                className="border-[var(--success)]/30"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
                  <span className="text-xs font-medium uppercase text-[var(--success)]">
                    {o.dimension}
                  </span>
                </div>
                <p className="text-body text-[var(--text-primary)]">
                  {o.message}
                </p>
                <p className="mt-1 font-mono text-caption text-[var(--text-muted)]">
                  z = {o.zScore}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
