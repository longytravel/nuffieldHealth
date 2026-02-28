"use client";

import { Button } from "@/components/ui/button";
import type { ConsultantFilters } from "@/lib/types";

interface ExportButtonProps {
  filters: ConsultantFilters;
}

export function ExportButton({ filters }: ExportButtonProps) {
  function handleExport() {
    const params = new URLSearchParams();
    if (filters.hospital) params.set("hospital", filters.hospital);
    if (filters.quality_tier) params.set("quality_tier", filters.quality_tier);
    if (filters.booking_state) params.set("booking_state", filters.booking_state);
    if (filters.search) params.set("search", filters.search);
    if (filters.bio_depth) params.set("bio_depth", filters.bio_depth);
    if (filters.has_photo !== undefined) params.set("has_photo", String(filters.has_photo));
    if (filters.has_fail_flags) params.set("has_fail_flags", "true");
    if (filters.has_warn_flags) params.set("has_warn_flags", "true");
    if (filters.bio_needs_expansion) params.set("bio_needs_expansion", "true");
    if (filters.missing_insurers) params.set("missing_insurers", "true");
    if (filters.missing_consultation_times) params.set("missing_consultation_times", "true");
    if (filters.missing_qualifications) params.set("missing_qualifications", "true");
    if (filters.missing_memberships) params.set("missing_memberships", "true");
    if (filters.score_min !== undefined) params.set("score_min", String(filters.score_min));
    if (filters.score_max !== undefined) params.set("score_max", String(filters.score_max));
    if (filters.specialty) params.set("specialty", filters.specialty);
    if (filters.sort_by) params.set("sort_by", filters.sort_by);
    if (filters.sort_dir) params.set("sort_dir", filters.sort_dir);

    const url = `/api/export?${params.toString()}`;
    window.location.href = url;
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      Export CSV
    </Button>
  );
}
