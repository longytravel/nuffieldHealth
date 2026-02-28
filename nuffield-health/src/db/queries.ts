import { db } from "./index";
import { scrapeRuns, consultants } from "./schema";
import { eq, desc, and, sql, like, or } from "drizzle-orm";
import type { ConsultantFilters } from "@/lib/types";

// Get the latest completed run
export function getLatestRun() {
  return db
    .select()
    .from(scrapeRuns)
    .where(eq(scrapeRuns.status, "completed"))
    .orderBy(desc(scrapeRuns.started_at))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

// Get all runs ordered by date
export function getRunHistory() {
  return db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.started_at));
}

// Get consultants for a run with optional filters
export function getConsultants(runId: string, filters?: ConsultantFilters) {
  const conditions = [eq(consultants.run_id, runId)];

  if (filters?.hospital) {
    conditions.push(like(consultants.hospital_name_primary, `%${filters.hospital}%`));
  }

  if (filters?.quality_tier) {
    conditions.push(eq(consultants.quality_tier, filters.quality_tier));
  }

  if (filters?.booking_state) {
    conditions.push(eq(consultants.booking_state, filters.booking_state));
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(consultants.consultant_name, term),
        like(consultants.slug, term),
        like(consultants.hospital_name_primary, term)
      )!
    );
  }

  const page = filters?.page ?? 1;
  const perPage = filters?.per_page ?? 50;
  const offset = (page - 1) * perPage;

  return db
    .select()
    .from(consultants)
    .where(and(...conditions))
    .orderBy(consultants.consultant_name)
    .limit(perPage)
    .offset(offset);
}

// Get a single consultant by run_id and slug
export function getConsultant(runId: string, slug: string) {
  return db
    .select()
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
    .then((rows) => rows[0] ?? null);
}

// Get quality tier distribution for a run
export function getQualityTierDistribution(runId: string) {
  return db
    .select({
      quality_tier: consultants.quality_tier,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(consultants)
    .where(eq(consultants.run_id, runId))
    .groupBy(consultants.quality_tier);
}

// Get flagged consultants for the review queue
export function getFlaggedConsultants(runId: string) {
  return db
    .select()
    .from(consultants)
    .where(
      and(
        eq(consultants.run_id, runId),
        eq(consultants.manually_reviewed, false),
        sql`(
          json_array_length(${consultants.flags}) > 0
          AND (
            EXISTS (
              SELECT 1 FROM json_each(${consultants.flags})
              WHERE json_extract(value, '$.severity') = 'fail'
            )
            OR EXISTS (
              SELECT 1 FROM json_each(${consultants.flags})
              WHERE json_extract(value, '$.code') = 'QA_LOW_CONFIDENCE'
            )
          )
        )`
      )
    )
    .orderBy(consultants.consultant_name);
}

// Get total count for a run (for pagination)
export function getConsultantCount(runId: string, filters?: ConsultantFilters) {
  const conditions = [eq(consultants.run_id, runId)];

  if (filters?.hospital) {
    conditions.push(like(consultants.hospital_name_primary, `%${filters.hospital}%`));
  }

  if (filters?.quality_tier) {
    conditions.push(eq(consultants.quality_tier, filters.quality_tier));
  }

  if (filters?.booking_state) {
    conditions.push(eq(consultants.booking_state, filters.booking_state));
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(consultants.consultant_name, term),
        like(consultants.slug, term),
        like(consultants.hospital_name_primary, term)
      )!
    );
  }

  return db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(consultants)
    .where(and(...conditions))
    .then((rows) => rows[0]?.count ?? 0);
}
