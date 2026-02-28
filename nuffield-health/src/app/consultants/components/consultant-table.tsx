"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/tier-badge";
import { GlassCard } from "@/components/ui/glass-card";
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";

interface ConsultantRow {
  slug: string;
  consultant_name: string | null;
  consultant_title_prefix: string | null;
  specialty_primary: string[];
  hospital_name_primary: string | null;
  quality_tier: string | null;
  profile_completeness_score: number | null;
  booking_state: string | null;
  available_slots_next_28_days: number | null;
  flags: { code: string; severity: string; message: string }[];
  plain_english_score: number | null;
  has_photo: boolean | null;
  profile_url: string | null;
}

interface ConsultantTableProps {
  consultants: ConsultantRow[];
  page: number;
  totalPages: number;
  totalCount: number;
  sortBy?: string;
  sortDir?: string;
}

const BOOKING_LABELS: Record<string, { label: string; color: string }> = {
  bookable_with_slots: { label: "Bookable", color: "var(--success)" },
  bookable_no_slots: { label: "No Slots", color: "var(--warning)" },
  not_bookable: { label: "Not Bookable", color: "var(--text-muted)" },
};

export function ConsultantTable({
  consultants,
  page,
  totalPages,
  totalCount,
  sortBy,
  sortDir,
}: ConsultantTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleSort(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortBy === column) {
      if (sortDir === "asc") {
        params.set("sort_dir", "desc");
      } else {
        params.delete("sort_by");
        params.delete("sort_dir");
      }
    } else {
      params.set("sort_by", column);
      params.set("sort_dir", "asc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function SortIcon({ column }: { column: string }) {
    if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3.5 w-3.5 text-[var(--sensai-teal)]" />;
    return <ArrowDown className="h-3.5 w-3.5 text-[var(--sensai-teal)]" />;
  }

  const startIndex = (page - 1) * 50 + 1;
  const endIndex = Math.min(page * 50, totalCount);

  // Generate pagination numbers
  const pageNumbers: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 3) pageNumbers.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pageNumbers.push(i);
    }
    if (page < totalPages - 2) pageNumbers.push("...");
    pageNumbers.push(totalPages);
  }

  return (
    <div className="min-w-0 space-y-4">
      <GlassCard className="min-w-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed" aria-label="Consultant profiles">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <SortableHeader label="Consultant" column="name" width="220px" sortBy={sortBy} sortDir={sortDir} toggleSort={toggleSort} SortIcon={SortIcon} />
                <th className="w-[140px] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Specialty</th>
                <SortableHeader label="Hospital" column="hospital" width="150px" sortBy={sortBy} sortDir={sortDir} toggleSort={toggleSort} SortIcon={SortIcon} />
                <SortableHeader label="Tier" column="tier" width="90px" sortBy={sortBy} sortDir={sortDir} toggleSort={toggleSort} SortIcon={SortIcon} />
                <SortableHeader label="Score" column="score" width="90px" sortBy={sortBy} sortDir={sortDir} toggleSort={toggleSort} SortIcon={SortIcon} align="right" />
                <SortableHeader label="Booking" column="booking" width="140px" sortBy={sortBy} sortDir={sortDir} toggleSort={toggleSort} SortIcon={SortIcon} />
                <th className="hidden w-[80px] px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] 2xl:table-cell">Flags</th>
                <th className="hidden w-[90px] px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] 2xl:table-cell">Plain Eng.</th>
                <th className="w-[90px] px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {consultants.map((c, idx) => {
                const bookingInfo = BOOKING_LABELS[c.booking_state ?? ""] ?? { label: "Unknown", color: "var(--text-muted)" };
                const failCount = c.flags.filter((f) => f.severity === "fail").length;
                const warnCount = c.flags.filter((f) => f.severity === "warn").length;
                const displayName = c.consultant_name ?? c.slug;
                const shouldPrefixName =
                  !!c.consultant_title_prefix &&
                  !displayName.startsWith(c.consultant_title_prefix);

                return (
                  <tr
                    key={c.slug}
                    className={`border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)]/50 hover:border-l-2 hover:border-l-[var(--sensai-teal)] ${
                      idx % 2 === 0 ? "bg-transparent" : "bg-[var(--bg-secondary)]/30"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium ${
                          c.has_photo
                            ? "bg-[var(--sensai-teal)]/15 text-[var(--sensai-teal)]"
                            : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                        }`}>
                          {(c.consultant_name ?? c.slug).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/consultants/${c.slug}`}
                            className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--sensai-teal)] transition-colors truncate block"
                          >
                            {shouldPrefixName ? `${c.consultant_title_prefix} ` : ""}
                            {displayName}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-[var(--text-secondary)] truncate block max-w-[150px]">
                        {c.specialty_primary.length > 0 ? c.specialty_primary[0] : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-[var(--text-secondary)] truncate block max-w-[180px]">
                        {c.hospital_name_primary ?? "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {c.quality_tier ? (
                        <TierBadge tier={c.quality_tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"} />
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {c.profile_completeness_score != null ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, c.profile_completeness_score)}%`,
                                backgroundColor: c.profile_completeness_score >= 80
                                  ? "var(--tier-gold)"
                                  : c.profile_completeness_score >= 60
                                  ? "var(--tier-silver)"
                                  : c.profile_completeness_score >= 40
                                  ? "var(--tier-bronze)"
                                  : "var(--tier-incomplete)",
                              }}
                            />
                          </div>
                          <span className="text-sm tabular-nums font-medium text-[var(--text-primary)] w-7 text-right">
                            {Math.round(c.profile_completeness_score)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="text-xs font-medium"
                        style={{ color: bookingInfo.color }}
                      >
                        {bookingInfo.label}
                      </span>
                      {c.available_slots_next_28_days != null && c.available_slots_next_28_days > 0 && (
                        <span className="ml-1 text-xs text-[var(--text-muted)]">
                          ({c.available_slots_next_28_days})
                        </span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-right 2xl:table-cell">
                      {c.flags.length > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          {failCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-[var(--danger)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--danger)]">
                              {failCount}
                            </span>
                          )}
                          {warnCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-[var(--warning)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--warning)]">
                              {warnCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-right 2xl:table-cell">
                      {c.plain_english_score != null ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <div
                                key={n}
                                className="h-3 w-1.5 rounded-sm"
                                style={{
                                  backgroundColor:
                                    n <= c.plain_english_score!
                                      ? c.plain_english_score! >= 4
                                        ? "var(--success)"
                                        : c.plain_english_score! >= 3
                                        ? "var(--warning)"
                                        : "var(--danger)"
                                      : "var(--bg-elevated)",
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-xs tabular-nums text-[var(--text-muted)]">
                            {c.plain_english_score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center">
                        <Link
                          href={`/consultants/${c.slug}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--sensai-teal)] bg-[var(--sensai-teal)]/10 hover:bg-[var(--sensai-teal)]/20 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Pagination */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Showing {startIndex}-{endIndex} of {totalCount.toLocaleString()}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="border-[var(--border-subtle)] text-[var(--text-secondary)]"
          >
            Previous
          </Button>
          {pageNumbers.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-sm text-[var(--text-muted)]">
                ...
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                onClick={() => goToPage(p)}
                className={
                  p === page
                    ? "bg-[var(--sensai-teal)] text-[var(--bg-primary)] hover:bg-[var(--sensai-teal-dark)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                }
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="border-[var(--border-subtle)] text-[var(--text-secondary)]"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  width,
  sortBy,
  sortDir,
  toggleSort,
  SortIcon,
  align = "left",
}: {
  label: string;
  column: string;
  width: string;
  sortBy?: string;
  sortDir?: string;
  toggleSort: (col: string) => void;
  SortIcon: React.FC<{ column: string }>;
  align?: "left" | "right";
}) {
  const ariaSortValue = sortBy === column
    ? sortDir === "asc" ? "ascending" as const : "descending" as const
    : "none" as const;

  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ width }}
      onClick={() => toggleSort(column)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(column); } }}
      tabIndex={0}
      role="columnheader"
      aria-sort={ariaSortValue}
      aria-label={`Sort by ${label}`}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        <SortIcon column={column} />
      </div>
    </th>
  );
}
