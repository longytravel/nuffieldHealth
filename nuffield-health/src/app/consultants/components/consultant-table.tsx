"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TIER_STYLES: Record<string, string> = {
  Gold: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  Silver: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  Bronze: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  Incomplete: "bg-red-100 text-red-700 hover:bg-red-100",
};

interface ConsultantRow {
  slug: string;
  consultant_name: string | null;
  specialty_primary: string[];
  hospital_name_primary: string | null;
  quality_tier: string | null;
  profile_completeness_score: number | null;
  booking_state: string | null;
  flags: { code: string; severity: string; message: string }[];
  profile_url: string | null;
}

interface ConsultantTableProps {
  consultants: ConsultantRow[];
  page: number;
  totalPages: number;
  totalCount: number;
}

export function ConsultantTable({
  consultants,
  page,
  totalPages,
  totalCount,
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

  const bookingLabel = (state: string | null) => {
    switch (state) {
      case "bookable_with_slots":
        return "Bookable";
      case "bookable_no_slots":
        return "No slots";
      case "not_bookable":
        return "Not bookable";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead className="text-right">Flags</TableHead>
              <TableHead>Live</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consultants.map((c) => (
              <TableRow key={c.slug}>
                <TableCell>
                  <Link
                    href={`/consultants/${c.slug}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {c.consultant_name ?? c.slug}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {c.specialty_primary.length > 0
                    ? c.specialty_primary.join(", ")
                    : "-"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {c.hospital_name_primary ?? "-"}
                </TableCell>
                <TableCell>
                  {c.quality_tier ? (
                    <Badge
                      variant="secondary"
                      className={TIER_STYLES[c.quality_tier] ?? ""}
                    >
                      {c.quality_tier}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.profile_completeness_score != null
                    ? Math.round(c.profile_completeness_score)
                    : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {bookingLabel(c.booking_state)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.flags.length > 0 ? c.flags.length : "-"}
                </TableCell>
                <TableCell>
                  <a
                    href={`https://www.nuffieldhealth.com/consultants/${c.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    View
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, totalCount)} of{" "}
          {totalCount.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
