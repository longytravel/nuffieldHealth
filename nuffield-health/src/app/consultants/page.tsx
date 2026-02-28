import { getLatestRun, getConsultants, getConsultantCount } from "@/db/queries";
import type { ConsultantFilters, QualityTier, BookingState } from "@/lib/types";
import { ConsultantFiltersBar } from "./components/consultant-filters";
import { ConsultantTable } from "./components/consultant-table";
import { ExportButton } from "./components/export-button";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConsultantsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const run = await getLatestRun();

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-2xl font-semibold">No Data Available</h1>
        <p className="text-muted-foreground">
          No completed scrape runs found. Run the scraper to populate data.
        </p>
      </div>
    );
  }

  const hospital = typeof params.hospital === "string" ? params.hospital : undefined;
  const quality_tier = typeof params.quality_tier === "string" ? params.quality_tier as QualityTier : undefined;
  const booking_state = typeof params.booking_state === "string" ? params.booking_state as BookingState : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page, 10) || 1) : 1;

  const filters: ConsultantFilters = {
    hospital,
    quality_tier,
    booking_state,
    search,
    page,
    per_page: 50,
  };

  const [consultantRows, totalCount] = await Promise.all([
    getConsultants(run.run_id, filters),
    getConsultantCount(run.run_id, filters),
  ]);

  const totalPages = Math.ceil(totalCount / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consultants</h1>
          <p className="text-muted-foreground">
            {totalCount.toLocaleString()} profiles found
          </p>
        </div>
        <ExportButton filters={filters} />
      </div>

      <ConsultantFiltersBar
        hospital={hospital}
        quality_tier={quality_tier}
        booking_state={booking_state}
        search={search}
      />

      {consultantRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16">
          <p className="text-lg font-medium">No consultants match your filters</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting or clearing your filters
          </p>
        </div>
      ) : (
        <ConsultantTable
          consultants={consultantRows}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      )}
    </div>
  );
}
