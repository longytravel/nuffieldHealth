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

    const url = `/api/export?${params.toString()}`;
    window.location.href = url;
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      Export CSV
    </Button>
  );
}
