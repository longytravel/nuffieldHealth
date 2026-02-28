"use server";

import { db } from "@/db/index";
import { consultants, scrapeRuns } from "@/db/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";

// Get the latest completed run (server-side helper)
function getLatestRunId(): string | null {
  const row = db
    .select({ run_id: scrapeRuns.run_id })
    .from(scrapeRuns)
    .where(eq(scrapeRuns.status, "completed"))
    .orderBy(desc(scrapeRuns.started_at))
    .limit(1)
    .get();
  return row?.run_id ?? null;
}

// All exportable columns (matches csv-export-builder.tsx)
const ALL_COLUMNS: Record<string, string> = {
  consultant_name: "Consultant Name",
  consultant_title_prefix: "Title Prefix",
  slug: "Slug",
  profile_url: "Profile URL",
  registration_number: "Registration Number",
  hospital_name_primary: "Hospital",
  profile_completeness_score: "Completeness Score",
  quality_tier: "Quality Tier",
  plain_english_score: "Plain English Score",
  bio_depth: "Bio Depth",
  treatment_specificity_score: "Treatment Specificity",
  qualifications_completeness: "Qualifications Rating",
  has_photo: "Has Photo",
  specialty_primary: "Specialties",
  insurer_count: "Insurer Count",
  practising_since: "Practising Since",
  languages: "Languages",
  clinical_interests: "Clinical Interests",
  booking_state: "Booking State",
  online_bookable: "Online Bookable",
  available_slots_next_28_days: "Available Slots (28 days)",
  consultation_price: "Consultation Price",
  next_available_date: "Next Available",
  days_to_first_available: "Days to First Available",
  plain_english_reason: "Plain English Reason",
  bio_depth_reason: "Bio Depth Reason",
  treatment_specificity_reason: "Treatment Reason",
  qualifications_completeness_reason: "Qualifications Reason",
  ai_quality_notes: "AI Quality Notes",
  flags: "All Flags (JSON)",
  scrape_status: "Scrape Status",
  scrape_error: "Scrape Error",
};

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportCsv(
  selectedColumns: string[],
  tierFilter: string,
  hospitalFilter: string
): Promise<string> {
  const runId = getLatestRunId();
  if (!runId) throw new Error("No completed runs found");

  // Validate columns
  const validColumns = selectedColumns.filter((c) => c in ALL_COLUMNS);
  if (validColumns.length === 0) throw new Error("No valid columns selected");

  // Build conditions
  const conditions = [eq(consultants.run_id, runId)];
  if (tierFilter && tierFilter !== "all") {
    conditions.push(eq(consultants.quality_tier, tierFilter));
  }
  if (hospitalFilter) {
    conditions.push(like(consultants.hospital_name_primary, `%${hospitalFilter}%`));
  }

  const rows = db
    .select()
    .from(consultants)
    .where(and(...conditions))
    .orderBy(consultants.consultant_name)
    .all();

  // Build CSV header
  const header = validColumns.map((c) => ALL_COLUMNS[c]).join(",");

  // Build CSV rows
  const csvRows = rows.map((row) => {
    return validColumns
      .map((col) => {
        const value = (row as Record<string, unknown>)[col];
        return escapeCsvField(value);
      })
      .join(",");
  });

  return [header, ...csvRows].join("\n");
}
