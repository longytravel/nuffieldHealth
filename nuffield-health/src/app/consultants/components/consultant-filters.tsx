"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { QualityTier, BookingState } from "@/lib/types";

interface ConsultantFiltersBarProps {
  hospital?: string;
  quality_tier?: QualityTier;
  booking_state?: BookingState;
  search?: string;
}

const QUALITY_TIERS: QualityTier[] = ["Gold", "Silver", "Bronze", "Incomplete"];
const BOOKING_STATES: { value: BookingState; label: string }[] = [
  { value: "bookable_with_slots", label: "Bookable (with slots)" },
  { value: "bookable_no_slots", label: "Bookable (no slots)" },
  { value: "not_bookable", label: "Not bookable" },
];

export function ConsultantFiltersBar({
  hospital,
  quality_tier,
  booking_state,
  search,
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

  const hasFilters = hospital || quality_tier || booking_state || search;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Search
        </label>
        <Input
          placeholder="Search by name, hospital..."
          defaultValue={search ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParams({ search: e.currentTarget.value });
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== (search ?? "")) {
              updateParams({ search: e.currentTarget.value });
            }
          }}
        />
      </div>

      <div className="min-w-[180px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Hospital
        </label>
        <Input
          placeholder="Filter by hospital..."
          defaultValue={hospital ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParams({ hospital: e.currentTarget.value });
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== (hospital ?? "")) {
              updateParams({ hospital: e.currentTarget.value });
            }
          }}
        />
      </div>

      <div className="min-w-[150px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Quality Tier
        </label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={quality_tier ?? ""}
          onChange={(e) =>
            updateParams({ quality_tier: e.target.value || null })
          }
        >
          <option value="">All tiers</option>
          {QUALITY_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[180px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Booking State
        </label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={booking_state ?? ""}
          onChange={(e) =>
            updateParams({ booking_state: e.target.value || null })
          }
        >
          <option value="">All states</option>
          {BOOKING_STATES.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
