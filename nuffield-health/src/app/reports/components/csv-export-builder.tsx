"use client";

import { useState, useTransition } from "react";
import { Download, Check, Search, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { exportCsv } from "../actions";

interface ColumnGroup {
  label: string;
  columns: { key: string; label: string; default: boolean }[];
}

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    label: "Identity",
    columns: [
      { key: "consultant_name", label: "Consultant Name", default: true },
      { key: "consultant_title_prefix", label: "Title Prefix", default: true },
      { key: "slug", label: "Slug", default: true },
      { key: "profile_url", label: "Profile URL", default: false },
      { key: "registration_number", label: "Registration Number", default: true },
      { key: "hospital_name_primary", label: "Hospital", default: true },
    ],
  },
  {
    label: "Quality Scores",
    columns: [
      { key: "profile_completeness_score", label: "Completeness Score", default: true },
      { key: "quality_tier", label: "Quality Tier", default: true },
      { key: "plain_english_score", label: "Plain English Score", default: true },
      { key: "bio_depth", label: "Bio Depth", default: true },
      { key: "treatment_specificity_score", label: "Treatment Specificity", default: true },
      { key: "qualifications_completeness", label: "Qualifications Rating", default: false },
    ],
  },
  {
    label: "Profile Fields",
    columns: [
      { key: "has_photo", label: "Has Photo", default: true },
      { key: "specialty_primary", label: "Specialties", default: true },
      { key: "insurer_count", label: "Insurer Count", default: true },
      { key: "practising_since", label: "Practising Since", default: false },
      { key: "languages", label: "Languages", default: false },
      { key: "clinical_interests", label: "Clinical Interests", default: false },
    ],
  },
  {
    label: "Booking Data",
    columns: [
      { key: "booking_state", label: "Booking State", default: true },
      { key: "online_bookable", label: "Online Bookable", default: true },
      { key: "available_slots_next_28_days", label: "Available Slots (28 days)", default: true },
      { key: "consultation_price", label: "Consultation Price", default: true },
      { key: "next_available_date", label: "Next Available", default: false },
      { key: "days_to_first_available", label: "Days to First Available", default: false },
    ],
  },
  {
    label: "AI Evidence",
    columns: [
      { key: "plain_english_reason", label: "Plain English Reason", default: false },
      { key: "bio_depth_reason", label: "Bio Depth Reason", default: false },
      { key: "treatment_specificity_reason", label: "Treatment Reason", default: false },
      { key: "qualifications_completeness_reason", label: "Qualifications Reason", default: false },
      { key: "ai_quality_notes", label: "AI Quality Notes", default: false },
    ],
  },
  {
    label: "Flags",
    columns: [
      { key: "flags", label: "All Flags (JSON)", default: false },
      { key: "scrape_status", label: "Scrape Status", default: false },
      { key: "scrape_error", label: "Scrape Error", default: false },
    ],
  },
];

const defaultColumns = new Set(
  COLUMN_GROUPS.flatMap((g) =>
    g.columns.filter((c) => c.default).map((c) => c.key)
  )
);

function triggerDownload(blob: Blob, filename: string): void {
  const nav = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (file: Blob, defaultName?: string) => boolean;
  };

  // Legacy Edge/IE fallback
  if (typeof nav.msSaveOrOpenBlob === "function") {
    nav.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Revoke after the browser has consumed the object URL.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

async function persistDownloadToDisk(blob: Blob, filename: string): Promise<void> {
  try {
    const formData = new FormData();
    const file = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
    });
    formData.append("file", file);

    const response = await fetch("/api/reports/save-download", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn("Server-side save failed:", message);
    }
  } catch (error) {
    console.warn("Server-side save failed:", error);
  }
}

export function CsvExportBuilder() {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultColumns));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(COLUMN_GROUPS.map((g) => g.label))
  );
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterHospital, setFilterHospital] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleExport() {
    startTransition(async () => {
      try {
        const csv = await exportCsv(
          Array.from(selected),
          filterTier,
          filterHospital
        );
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const filename = `sensai-consultants-${new Date().toISOString().slice(0, 10)}.csv`;
        triggerDownload(blob, filename);
        await persistDownloadToDisk(blob, filename);
      } catch (err) {
        console.error("CSV export failed:", err);
      }
    });
  }

  function toggleColumn(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleGroup(groupLabel: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupLabel)) {
        next.delete(groupLabel);
      } else {
        next.add(groupLabel);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(
      new Set(COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.key)))
    );
  }

  function selectDefaults() {
    setSelected(new Set(defaultColumns));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-h3 text-[var(--text-primary)]">CSV Export Builder</h2>
          <p className="text-caption text-[var(--text-muted)]">
            Select columns and filters, then download your data
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isPending || selected.size === 0}
          className="flex items-center gap-2 rounded-lg bg-[var(--sensai-teal)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:bg-[var(--sensai-teal-light)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isPending ? "Exporting..." : `Export CSV (${selected.size} columns)`}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        {/* Column picker */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Columns ({selected.size} selected)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="rounded px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                Select All
              </button>
              <button
                onClick={selectDefaults}
                className="rounded px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                Defaults
              </button>
              <button
                onClick={clearAll}
                className="rounded px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1">
            {COLUMN_GROUPS.map((group) => {
              const expanded = expandedGroups.has(group.label);
              const groupSelectedCount = group.columns.filter((c) =>
                selected.has(c.key)
              ).length;

              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <span className="flex items-center gap-2">
                      {group.label}
                      <span className="rounded-full bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                        {groupSelectedCount}/{group.columns.length}
                      </span>
                    </span>
                    {expanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  {expanded && (
                    <div className="ml-2 flex flex-col gap-0.5 pb-1">
                      {group.columns.map((col) => {
                        const checked = selected.has(col.key);
                        return (
                          <label
                            key={col.key}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-elevated)]",
                              checked
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-muted)]"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                checked
                                  ? "border-[var(--sensai-teal)] bg-[var(--sensai-teal)]"
                                  : "border-[var(--border-subtle)] bg-transparent"
                              )}
                              onClick={() => toggleColumn(col.key)}
                            >
                              {checked && (
                                <Check className="h-3 w-3 text-[var(--bg-primary)]" />
                              )}
                            </div>
                            <span onClick={() => toggleColumn(col.key)}>
                              {col.label}
                            </span>
                            <code className="ml-auto font-mono text-[9px] text-[var(--text-muted)]">
                              {col.key}
                            </code>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Filter sidebar */}
        <div className="flex flex-col gap-4">
          <GlassCard className="p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Filters
            </h3>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Narrow down which rows to export
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Quality Tier
                </label>
                <select
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--sensai-teal)] focus:outline-none"
                >
                  <option value="all">All Tiers</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Incomplete">Incomplete</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Hospital
                </label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={filterHospital}
                    onChange={(e) => setFilterHospital(e.target.value)}
                    placeholder="Filter by hospital..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1.5 pl-7 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--sensai-teal)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Export Preview
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>Columns</span>
                <span className="font-mono text-[var(--text-accent)]">
                  {selected.size}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tier filter</span>
                <span className="font-mono text-[var(--text-accent)]">
                  {filterTier === "all" ? "None" : filterTier}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Hospital filter</span>
                <span className="font-mono text-[var(--text-accent)]">
                  {filterHospital || "None"}
                </span>
              </div>
              <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
                <p className="text-[10px] text-[var(--text-muted)]">
                  Note: Contact fields (phone, email) are excluded from CSV export by default per data governance policy.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
