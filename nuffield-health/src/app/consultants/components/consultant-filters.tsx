"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";
import { TierBadge } from "@/components/ui/tier-badge";
import type { FilterCounts } from "@/lib/types";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Camera,
  CameraOff,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

interface ConsultantFiltersBarProps {
  filterCounts: FilterCounts;
  hospital?: string;
  quality_tier?: string;
  booking_state?: string;
  search?: string;
  bio_depth?: string;
  has_photo?: string;
  has_fail_flags?: string;
  has_warn_flags?: string;
  bio_needs_expansion?: string;
  missing_insurers?: string;
  missing_consultation_times?: string;
  missing_qualifications?: string;
  missing_memberships?: string;
  score_min?: string;
  score_max?: string;
  specialty?: string;
}

const BOOKING_LABELS: Record<string, string> = {
  bookable_with_slots: "Bookable + Slots",
  bookable_no_slots: "Bookable, No Slots",
  not_bookable: "Not Bookable",
};

const BIO_LABELS: Record<string, string> = {
  substantive: "Substantive",
  adequate: "Adequate",
  thin: "Thin",
  missing: "Missing",
};

export function ConsultantFiltersBar({
  filterCounts,
  hospital,
  quality_tier,
  booking_state,
  search,
  bio_depth,
  has_photo,
  has_fail_flags,
  has_warn_flags,
  bio_needs_expansion,
  missing_insurers,
  missing_consultation_times,
  missing_qualifications,
  missing_memberships,
  score_min,
  score_max,
  specialty,
}: ConsultantFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const activeFilters: { key: string; label: string }[] = [];
  if (quality_tier) activeFilters.push({ key: "quality_tier", label: `Tier: ${quality_tier}` });
  if (booking_state) activeFilters.push({ key: "booking_state", label: `Booking: ${BOOKING_LABELS[booking_state] ?? booking_state}` });
  if (hospital) activeFilters.push({ key: "hospital", label: `Hospital: ${hospital}` });
  if (specialty) activeFilters.push({ key: "specialty", label: `Specialty: ${specialty}` });
  if (bio_depth) activeFilters.push({ key: "bio_depth", label: `Bio: ${BIO_LABELS[bio_depth] ?? bio_depth}` });
  if (has_photo === "true") activeFilters.push({ key: "has_photo", label: "Has Photo" });
  if (has_photo === "false") activeFilters.push({ key: "has_photo", label: "Missing Photo" });
  if (has_fail_flags === "true") activeFilters.push({ key: "has_fail_flags", label: "Has Fail Flags" });
  if (has_warn_flags === "true") activeFilters.push({ key: "has_warn_flags", label: "Has Warn Flags" });
  if (bio_needs_expansion === "true") activeFilters.push({ key: "bio_needs_expansion", label: "Bio Needs Expansion" });
  if (missing_insurers === "true") activeFilters.push({ key: "missing_insurers", label: "Missing Insurers" });
  if (missing_consultation_times === "true") activeFilters.push({ key: "missing_consultation_times", label: "Missing Consultation Times" });
  if (missing_qualifications === "true") activeFilters.push({ key: "missing_qualifications", label: "Missing Qualifications" });
  if (missing_memberships === "true") activeFilters.push({ key: "missing_memberships", label: "Missing Memberships" });
  if (score_min) activeFilters.push({ key: "score_min", label: `Score >= ${score_min}` });
  if (score_max) activeFilters.push({ key: "score_max", label: `Score <= ${score_max}` });
  if (search) activeFilters.push({ key: "search", label: `Search: ${search}` });

  return (
    <div className="w-full shrink-0 space-y-4 2xl:w-[280px]">
      {/* Active Filter Pills */}
      {activeFilters.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => updateParams({ [f.key]: null })}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--sensai-teal)]/15 px-2.5 py-1 text-xs font-medium text-[var(--sensai-teal)] transition-colors hover:bg-[var(--sensai-teal)]/25"
              >
                {f.label}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
          <button
            onClick={clearAll}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Search */}
      <GlassCard className="p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
          <Input
            placeholder="Search consultants..."
            defaultValue={search ?? ""}
            className="pl-9 bg-transparent border-[var(--border-subtle)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParams({ search: e.currentTarget.value || null });
              }
            }}
          />
        </div>
      </GlassCard>

      {/* Quality Tier */}
      <FilterGroup title="Quality Tier" defaultOpen>
        <div className="space-y-1.5">
          {(["Gold", "Silver", "Bronze", "Incomplete"] as const).map((tier) => {
            const count = filterCounts.tiers[tier] ?? 0;
            const isActive = quality_tier === tier;
            return (
              <button
                key={tier}
                onClick={() => updateParams({ quality_tier: isActive ? null : tier })}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
                }`}
              >
                <TierBadge tier={tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"} />
                <span className="text-xs text-[var(--text-muted)] tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {/* Booking State */}
      <FilterGroup title="Booking State" defaultOpen>
        <div className="space-y-1.5">
          {Object.entries(BOOKING_LABELS).map(([value, label]) => {
            const count = filterCounts.booking_states[value] ?? 0;
            const isActive = booking_state === value;
            return (
              <button
                key={value}
                onClick={() => updateParams({ booking_state: isActive ? null : value })}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
                }`}
              >
                <span>{label}</span>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {/* Hospital */}
      <FilterGroup title="Hospital">
        <SearchableList
          items={filterCounts.hospitals}
          selected={hospital ?? null}
          onSelect={(val) => updateParams({ hospital: val })}
          placeholder="Search hospitals..."
        />
      </FilterGroup>

      {/* Specialty */}
      <FilterGroup title="Specialty">
        <SearchableList
          items={filterCounts.specialties}
          selected={specialty ?? null}
          onSelect={(val) => updateParams({ specialty: val })}
          placeholder="Search specialties..."
        />
      </FilterGroup>

      {/* Score Range */}
      <FilterGroup title="Score Range">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Min"
              defaultValue={score_min ?? ""}
              className="h-8 bg-transparent border-[var(--border-subtle)] text-sm"
              onBlur={(e) => updateParams({ score_min: e.currentTarget.value || null })}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateParams({ score_min: e.currentTarget.value || null });
              }}
            />
            <span className="text-[var(--text-muted)] text-xs">to</span>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Max"
              defaultValue={score_max ?? ""}
              className="h-8 bg-transparent border-[var(--border-subtle)] text-sm"
              onBlur={(e) => updateParams({ score_max: e.currentTarget.value || null })}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateParams({ score_max: e.currentTarget.value || null });
              }}
            />
          </div>
        </div>
      </FilterGroup>

      {/* Flags */}
      <FilterGroup title="Flags">
        <div className="space-y-1.5">
          <button
            onClick={() => updateParams({ has_fail_flags: has_fail_flags === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              has_fail_flags === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-[var(--danger)]" />
              Fail Flags
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.flags.fail}</span>
          </button>
          <button
            onClick={() => updateParams({ has_warn_flags: has_warn_flags === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              has_warn_flags === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning)]" />
              Warn Flags
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.flags.warn}</span>
          </button>
        </div>
      </FilterGroup>

      {/* Improvement Actions */}
      <FilterGroup title="Improvement Actions" defaultOpen>
        <div className="space-y-1.5">
          <button
            onClick={() => updateParams({ missing_insurers: missing_insurers === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              missing_insurers === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span>Missing insurers</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.action_gaps.missing_insurers}</span>
          </button>

          <button
            onClick={() => updateParams({ missing_consultation_times: missing_consultation_times === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              missing_consultation_times === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span>Missing consultation times</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.action_gaps.missing_consultation_times}</span>
          </button>

          <button
            onClick={() => updateParams({ bio_needs_expansion: bio_needs_expansion === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              bio_needs_expansion === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span>Bio needs expansion</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.action_gaps.bio_needs_expansion}</span>
          </button>

          <button
            onClick={() => updateParams({ missing_memberships: missing_memberships === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              missing_memberships === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span>Missing memberships</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.action_gaps.missing_memberships}</span>
          </button>

          <button
            onClick={() => updateParams({ has_photo: has_photo === "false" ? null : "false" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              has_photo === "false"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span>Missing photos</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.photo.missing}</span>
          </button>

          <button
            onClick={() => updateParams({ missing_qualifications: missing_qualifications === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              missing_qualifications === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span>Missing qualifications</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.action_gaps.missing_qualifications}</span>
          </button>
        </div>
      </FilterGroup>

      {/* Bio Depth */}
      <FilterGroup title="Bio Depth">
        <div className="space-y-1.5">
          {Object.entries(BIO_LABELS).map(([value, label]) => {
            const count = filterCounts.bio_depths[value] ?? 0;
            const isActive = bio_depth === value;
            return (
              <button
                key={value}
                onClick={() => updateParams({ bio_depth: isActive ? null : value })}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
                }`}
              >
                <span>{label}</span>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {/* Photo */}
      <FilterGroup title="Photo">
        <div className="space-y-1.5">
          <button
            onClick={() => updateParams({ has_photo: has_photo === "true" ? null : "true" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              has_photo === "true"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5" />
              Has Photo
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.photo.has}</span>
          </button>
          <button
            onClick={() => updateParams({ has_photo: has_photo === "false" ? null : "false" })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              has_photo === "false"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <CameraOff className="h-3.5 w-3.5" />
              Missing Photo
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{filterCounts.photo.missing}</span>
          </button>
        </div>
      </FilterGroup>
    </div>
  );
}

// Collapsible filter group
function FilterGroup({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>
      {open && <div className="px-2 pb-3">{children}</div>}
    </GlassCard>
  );
}

// Searchable list for hospitals and specialties
function SearchableList({
  items,
  selected,
  onSelect,
  placeholder,
}: {
  items: { name: string; count: number }[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  placeholder: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = searchTerm
    ? items.filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : items;

  return (
    <div className="space-y-2">
      <Input
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-8 bg-transparent border-[var(--border-subtle)] text-sm"
      />
      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
        {filtered.slice(0, 50).map((item) => {
          const isActive = selected === item.name;
          return (
            <button
              key={item.name}
              onClick={() => onSelect(isActive ? null : item.name)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                isActive
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
              }`}
            >
              <span className="truncate mr-2">{item.name}</span>
              <span className="text-[var(--text-muted)] tabular-nums shrink-0">{item.count}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-[var(--text-muted)]">No results</p>
        )}
      </div>
    </div>
  );
}
