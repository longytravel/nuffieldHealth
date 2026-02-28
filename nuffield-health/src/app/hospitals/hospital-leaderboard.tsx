"use client";

import { useState } from "react";
import type { HospitalBenchmark } from "@/db/queries";

type SortKey = "avgScore" | "consultantCount" | "goldPct" | "bookablePct" | "photoPct" | "bioQualityPct";

interface HospitalLeaderboardProps {
  hospitals: HospitalBenchmark[];
}

export function HospitalLeaderboard({ hospitals }: HospitalLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("avgScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...hospitals].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "asc" ? diff : -diff;
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-4">
      <h2 className="text-h2 text-[var(--text-primary)]">
        Leaderboard
      </h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">
                Hospital
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => handleSort("consultantCount")}
              >
                Count{arrow("consultantCount")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => handleSort("avgScore")}
              >
                Avg Score{arrow("avgScore")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => handleSort("goldPct")}
              >
                Gold %{arrow("goldPct")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => handleSort("bookablePct")}
              >
                Bookable %{arrow("bookablePct")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => handleSort("photoPct")}
              >
                Photo %{arrow("photoPct")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => handleSort("bioQualityPct")}
              >
                Bio Quality %{arrow("bioQualityPct")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => (
              <tr
                key={h.hospitalName}
                className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-glass)]"
              >
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                  {i + 1}
                </td>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                  {h.hospitalName}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                  {h.consultantCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                  {h.avgScore}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--tier-gold)]">
                  {h.goldPct}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                  {h.bookablePct}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                  {h.photoPct}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                  {h.bioQualityPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
