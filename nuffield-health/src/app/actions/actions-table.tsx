"use client";

import Link from "next/link";
import type { ActionItem } from "@/db/queries";

interface ActionsTableProps {
  actions: ActionItem[];
}

export function ActionsTable({ actions }: ActionsTableProps) {
  const handleExportCsv = () => {
    const headers = [
      "Rank",
      "Action",
      "Profiles Affected",
      "Points Per Profile",
      "Total Impact",
    ];
    const rows = actions.map((a) => [
      a.rank,
      `"${a.action}"`,
      a.profilesAffected,
      a.pointsPerProfile,
      a.totalImpact,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "action-plan.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-[var(--text-primary)]">
          Prioritized Actions
        </h2>
        <button
          onClick={handleExportCsv}
          className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">
                Action
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)]">
                Profiles
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)]">
                Points Each
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[var(--text-muted)]">
                Total Impact
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-[var(--text-muted)]">
                View
              </th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr
                key={a.rank}
                className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-glass)]"
              >
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                  #{a.rank}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-[var(--text-primary)]">
                    {a.action}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {a.description}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                  {a.profilesAffected.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-accent)]">
                  +{a.pointsPerProfile}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {a.totalImpact.toLocaleString()}
                  </span>
                  <span className="ml-1 text-xs text-[var(--text-muted)]">
                    pts
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Link
                    href={`/consultants?${a.filterParam}`}
                    className="text-xs text-[var(--text-accent)] hover:underline"
                  >
                    View profiles
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
