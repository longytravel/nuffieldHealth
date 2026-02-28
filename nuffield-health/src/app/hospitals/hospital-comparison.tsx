"use client";

import { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import type { HospitalBenchmark } from "@/db/queries";

const CHART_COLORS = [
  "var(--sensai-teal)",
  "var(--tier-gold)",
  "var(--sensai-blue)",
  "var(--tier-bronze)",
];

interface HospitalComparisonProps {
  hospitals: HospitalBenchmark[];
}

export function HospitalComparison({ hospitals }: HospitalComparisonProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleHospital = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 4) return prev;
      return [...prev, name];
    });
  };

  const selectedHospitals = hospitals.filter((h) =>
    selected.includes(h.hospitalName)
  );

  const dimensions = [
    { key: "avgScore", label: "Avg Score", max: 100 },
    { key: "photoPct", label: "Photo %", max: 100 },
    { key: "bioQualityPct", label: "Bio Quality %", max: 100 },
    { key: "bookablePct", label: "Bookable %", max: 100 },
    { key: "goldPct", label: "Gold %", max: 100 },
    { key: "insurerPct", label: "Insurer %", max: 100 },
    { key: "avgPlainEnglish", label: "Plain English", max: 10 },
  ];

  const radarData = dimensions.map((dim) => {
    const entry: Record<string, string | number> = { dimension: dim.label };
    for (const h of selectedHospitals) {
      const raw = h[dim.key as keyof HospitalBenchmark] as number;
      // Normalize to 0-100 scale for radar chart
      entry[h.hospitalName] =
        dim.max === 10 ? Math.round(raw * 10) : Math.round(raw);
    }
    return entry;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-[var(--text-primary)]">
          Compare Hospitals
        </h2>
        <span className="text-caption text-[var(--text-muted)]">
          Select 2-4 hospitals ({selected.length}/4)
        </span>
      </div>

      {/* Hospital selection chips */}
      <div className="flex flex-wrap gap-2">
        {hospitals.map((h) => {
          const isSelected = selected.includes(h.hospitalName);
          return (
            <button
              key={h.hospitalName}
              onClick={() => toggleHospital(h.hospitalName)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-[var(--sensai-teal)] text-[var(--bg-primary)]"
                  : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
              } ${
                !isSelected && selected.length >= 4
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer"
              }`}
              disabled={!isSelected && selected.length >= 4}
            >
              {h.hospitalName} ({h.consultantCount})
            </button>
          );
        })}
      </div>

      {/* Radar chart */}
      {selectedHospitals.length >= 2 && (
        <GlassCard>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              />
              {selectedHospitals.map((h, i) => (
                <Radar
                  key={h.hospitalName}
                  name={h.hospitalName}
                  dataKey={h.hospitalName}
                  stroke={CHART_COLORS[i]}
                  fill={CHART_COLORS[i]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {selectedHospitals.length < 2 && selected.length > 0 && (
        <GlassCard className="py-8 text-center text-[var(--text-muted)]">
          Select at least 2 hospitals to compare
        </GlassCard>
      )}
    </div>
  );
}
