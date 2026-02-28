"use client";

import type { SpecialtyBenchmark } from "@/db/queries";

interface SpecialtyHeatmapProps {
  specialties: SpecialtyBenchmark[];
}

const DIMENSIONS: { key: keyof SpecialtyBenchmark; label: string; max: number }[] = [
  { key: "photoPct", label: "Photo %", max: 100 },
  { key: "bioQualityPct", label: "Bio Quality %", max: 100 },
  { key: "avgScore", label: "Avg Score", max: 100 },
  { key: "bookablePct", label: "Bookable %", max: 100 },
  { key: "avgPlainEnglish", label: "Plain English", max: 10 },
  { key: "insurerPct", label: "Insurer %", max: 100 },
];

function getCellColor(value: number, max: number): string {
  const pct = max === 10 ? value * 10 : value;
  if (pct >= 70) return "rgba(16, 185, 129, 0.25)"; // green
  if (pct >= 40) return "rgba(245, 158, 11, 0.25)"; // amber
  return "rgba(239, 68, 68, 0.25)"; // red
}

function getCellTextColor(value: number, max: number): string {
  const pct = max === 10 ? value * 10 : value;
  if (pct >= 70) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--danger)";
}

export function SpecialtyHeatmap({ specialties }: SpecialtyHeatmapProps) {
  // Only show specialties with >= 5 consultants in heatmap
  const filtered = specialties.filter((s) => s.consultantCount >= 5);

  return (
    <div className="space-y-4">
      <h2 className="text-h2 text-[var(--text-primary)]">Quality Heatmap</h2>
      <p className="text-caption text-[var(--text-muted)]">
        Specialties with fewer than 5 consultants are excluded. Colors: green (&gt;70%), amber (40-70%), red (&lt;40%).
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <th className="sticky left-0 z-10 bg-[var(--bg-secondary)] px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">
                Specialty
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-[var(--text-muted)]">
                N
              </th>
              {DIMENSIONS.map((dim) => (
                <th
                  key={dim.key}
                  className="px-4 py-3 text-center text-xs font-medium uppercase text-[var(--text-muted)]"
                >
                  {dim.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((spec) => (
              <tr
                key={spec.specialty}
                className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-glass)]"
              >
                <td className="sticky left-0 z-10 bg-[var(--bg-primary)] px-4 py-2.5 font-medium text-[var(--text-primary)]">
                  {spec.specialty}
                </td>
                <td className="px-4 py-2.5 text-center font-mono text-xs text-[var(--text-muted)]">
                  {spec.consultantCount}
                </td>
                {DIMENSIONS.map((dim) => {
                  const val = spec[dim.key] as number;
                  return (
                    <td
                      key={dim.key}
                      className="px-4 py-2.5 text-center font-mono text-xs"
                      style={{
                        backgroundColor: getCellColor(val, dim.max),
                        color: getCellTextColor(val, dim.max),
                      }}
                    >
                      {dim.max === 10 ? val.toFixed(1) : `${val}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
