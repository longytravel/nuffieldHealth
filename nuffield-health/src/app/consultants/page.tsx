import { getLatestRun, getConsultants, getConsultantCount, getFilterCounts } from "@/db/queries";
import type { ConsultantFilters, QualityTier, BookingState, BioDepth } from "@/lib/types";
import { ConsultantFiltersBar } from "./components/consultant-filters";
import { ConsultantTable } from "./components/consultant-table";
import { ExportButton } from "./components/export-button";
import { PageTransition } from "@/components/ui/page-transition";
import { Users } from "lucide-react";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConsultantsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const run = await getLatestRun();

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-h1 text-[var(--text-primary)]">No Data Available</h1>
        <p className="text-[var(--text-secondary)]">
          No completed scrape runs found. Run the scraper to populate data.
        </p>
      </div>
    );
  }

  const str = (key: string) => typeof params[key] === "string" ? params[key] : undefined;

  const hospital = str("hospital");
  const quality_tier = str("quality_tier") as QualityTier | undefined;
  const booking_state = str("booking_state") as BookingState | undefined;
  const search = str("search");
  const bio_depth = str("bio_depth") as BioDepth | undefined;
  const has_photo_str = str("has_photo");
  const has_photo = has_photo_str === "true" ? true : has_photo_str === "false" ? false : undefined;
  const has_fail_flags = str("has_fail_flags") === "true" ? true : undefined;
  const has_warn_flags = str("has_warn_flags") === "true" ? true : undefined;
  const score_min = str("score_min") ? Number(str("score_min")) : undefined;
  const score_max = str("score_max") ? Number(str("score_max")) : undefined;
  const specialty = str("specialty");
  const sort_by = str("sort_by");
  const sort_dir = str("sort_dir") as "asc" | "desc" | undefined;
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page, 10) || 1) : 1;

  const filters: ConsultantFilters = {
    hospital,
    quality_tier,
    booking_state,
    search,
    bio_depth,
    has_photo,
    has_fail_flags,
    has_warn_flags,
    score_min: score_min !== undefined && !isNaN(score_min) ? score_min : undefined,
    score_max: score_max !== undefined && !isNaN(score_max) ? score_max : undefined,
    specialty,
    sort_by,
    sort_dir,
    page,
    per_page: 50,
  };

  const [consultantRows, totalCount, filterCounts] = await Promise.all([
    getConsultants(run.run_id, filters),
    getConsultantCount(run.run_id, filters),
    getFilterCounts(run.run_id),
  ]);

  const totalPages = Math.ceil(totalCount / 50);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sensai-teal)]/15">
            <Users className="h-5 w-5 text-[var(--sensai-teal)]" />
          </div>
          <div>
            <h1 className="text-h1 text-[var(--text-primary)]">Consultant Explorer</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {totalCount.toLocaleString()} profiles found
            </p>
          </div>
        </div>
        <ExportButton filters={filters} />
      </div>

      {/* Main Layout: Sidebar + Data Grid */}
      <div className="flex flex-col gap-6 2xl:flex-row">
        {/* Filter Sidebar — hidden on mobile, stacks on tablet, side-by-side on desktop */}
        <ConsultantFiltersBar
          filterCounts={filterCounts}
          hospital={hospital}
          quality_tier={quality_tier}
          booking_state={booking_state}
          search={search}
          bio_depth={bio_depth}
          has_photo={has_photo_str}
          has_fail_flags={str("has_fail_flags")}
          has_warn_flags={str("has_warn_flags")}
          score_min={str("score_min")}
          score_max={str("score_max")}
          specialty={specialty}
        />

        {/* Data Grid */}
        <div className="flex-1 min-w-0">
          {consultantRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] py-16">
              <Users className="h-10 w-10 text-[var(--text-muted)]" />
              <p className="text-lg font-medium text-[var(--text-primary)]">No consultants match your filters</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Try adjusting or clearing your filters
              </p>
            </div>
          ) : (
            <ConsultantTable
              consultants={consultantRows}
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              sortBy={sort_by}
              sortDir={sort_dir}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
