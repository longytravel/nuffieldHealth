import { NextRequest } from "next/server";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getLatestRun, getConsultants } from "@/db/queries";
import { EXPORT_INCLUDE_CONTACT_DATA } from "@/lib/config";
import type { ConsultantFilters, QualityTier, BookingState, BioDepth } from "@/lib/types";

const CONTACT_FIELDS = ["contact_phone", "contact_mobile", "contact_email"];

function auditLogExport(ip: string) {
  const logPath = "data/audit.log";
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(
      logPath,
      `${new Date().toISOString()}\texport_with_contact_data\t-\t${ip}\n`
    );
  } catch {
    // Non-blocking
  }
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const run = await getLatestRun();

  if (!run) {
    return new Response("No completed run found", { status: 404 });
  }

  const filters: ConsultantFilters = {
    hospital: searchParams.get("hospital") ?? undefined,
    quality_tier: (searchParams.get("quality_tier") as QualityTier) ?? undefined,
    booking_state: (searchParams.get("booking_state") as BookingState) ?? undefined,
    search: searchParams.get("search") ?? undefined,
    bio_depth: (searchParams.get("bio_depth") as BioDepth) ?? undefined,
    has_photo: searchParams.get("has_photo") === "true" ? true : searchParams.get("has_photo") === "false" ? false : undefined,
    has_fail_flags: searchParams.get("has_fail_flags") === "true" ? true : undefined,
    has_warn_flags: searchParams.get("has_warn_flags") === "true" ? true : undefined,
    bio_needs_expansion: searchParams.get("bio_needs_expansion") === "true" ? true : undefined,
    missing_insurers: searchParams.get("missing_insurers") === "true" ? true : undefined,
    missing_consultation_times: searchParams.get("missing_consultation_times") === "true" ? true : undefined,
    missing_qualifications: searchParams.get("missing_qualifications") === "true" ? true : undefined,
    missing_memberships: searchParams.get("missing_memberships") === "true" ? true : undefined,
    score_min: searchParams.get("score_min") && !Number.isNaN(Number(searchParams.get("score_min")))
      ? Number(searchParams.get("score_min"))
      : undefined,
    score_max: searchParams.get("score_max") && !Number.isNaN(Number(searchParams.get("score_max")))
      ? Number(searchParams.get("score_max"))
      : undefined,
    specialty: searchParams.get("specialty") ?? undefined,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_dir: (searchParams.get("sort_dir") as "asc" | "desc" | null) ?? undefined,
    page: 1,
    per_page: 100000, // Export all matching
  };

  const rows = await getConsultants(run.run_id, filters);

  if (rows.length === 0) {
    return new Response("No data to export", { status: 404 });
  }

  // Determine columns — exclude contact fields unless env allows
  const sampleKeys = Object.keys(rows[0]);
  const columns = EXPORT_INCLUDE_CONTACT_DATA
    ? sampleKeys
    : sampleKeys.filter((k) => !CONTACT_FIELDS.includes(k));

  // Audit log if contact data is included
  if (EXPORT_INCLUDE_CONTACT_DATA) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    auditLogExport(ip);
  }

  // Build CSV
  const header = columns.map(escapeCsvField).join(",");
  const csvRows = rows.map((row) => {
    const record = row as Record<string, unknown>;
    return columns.map((col) => escapeCsvField(record[col])).join(",");
  });
  const csv = [header, ...csvRows].join("\n");

  const filename = `nuffield-consultants-${run.run_id.slice(0, 8)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
