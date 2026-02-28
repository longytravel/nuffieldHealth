import { db } from "./index";
import { scrapeRuns, consultants } from "./schema";
import { eq, desc, and, sql, like, or, asc } from "drizzle-orm";
import type { ConsultantFilters, FilterCounts } from "@/lib/types";

const REVIEW_QUEUE_RULE = sql`(
  ${consultants.quality_tier} = 'Incomplete'
  OR (
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
  )
)`;

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

// Build shared filter conditions for getConsultants and getConsultantCount
function buildFilterConditions(runId: string, filters?: ConsultantFilters) {
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

  if (filters?.bio_depth) {
    conditions.push(eq(consultants.bio_depth, filters.bio_depth));
  }

  if (filters?.has_photo !== undefined) {
    conditions.push(
      sql`${consultants.has_photo} = ${filters.has_photo ? 1 : 0}`
    );
  }

  if (filters?.has_fail_flags) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${consultants.flags}) WHERE json_extract(value, '$.severity') = 'fail')`
    );
  }

  if (filters?.has_warn_flags) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${consultants.flags}) WHERE json_extract(value, '$.severity') = 'warn')`
    );
  }

  if (filters?.score_min !== undefined) {
    conditions.push(
      sql`${consultants.profile_completeness_score} >= ${filters.score_min}`
    );
  }

  if (filters?.score_max !== undefined) {
    conditions.push(
      sql`${consultants.profile_completeness_score} <= ${filters.score_max}`
    );
  }

  if (filters?.specialty) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${consultants.specialty_primary}) WHERE value = ${filters.specialty})`
    );
  }

  return conditions;
}

// Build sort order from filters
function buildSortOrder(filters?: ConsultantFilters) {
  const dir = filters?.sort_dir === "desc" ? desc : asc;
  switch (filters?.sort_by) {
    case "score":
      return dir(consultants.profile_completeness_score);
    case "name":
      return dir(consultants.consultant_name);
    case "hospital":
      return dir(consultants.hospital_name_primary);
    case "tier":
      return dir(consultants.quality_tier);
    case "booking":
      return dir(consultants.booking_state);
    case "price":
      return dir(consultants.consultation_price);
    case "plain_english":
      return dir(consultants.plain_english_score);
    default:
      return asc(consultants.consultant_name);
  }
}

// Get consultants for a run with optional filters
export function getConsultants(runId: string, filters?: ConsultantFilters) {
  const conditions = buildFilterConditions(runId, filters);

  const page = filters?.page ?? 1;
  const perPage = filters?.per_page ?? 50;
  const offset = (page - 1) * perPage;

  return db
    .select()
    .from(consultants)
    .where(and(...conditions))
    .orderBy(buildSortOrder(filters))
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
        REVIEW_QUEUE_RULE
      )
    )
    .orderBy(consultants.consultant_name);
}

// ============================================================
// Executive Dashboard Queries
// ============================================================

export interface DashboardKPIs {
  totalProfiles: number;
  avgScore: number;
  goldPct: number;
  bookableCount: number;
  needsReview: number;
  avgPlainEnglish: number;
  missingPhotos: number;
  avgPrice: number | null;
}

export function getDashboardKPIs(runId: string): DashboardKPIs {
  const row = db
    .select({
      totalProfiles: sql<number>`count(*)`,
      avgScore: sql<number>`coalesce(avg(${consultants.profile_completeness_score}), 0)`,
      goldCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Gold' then 1 else 0 end)`,
      bookableCount: sql<number>`sum(case when ${consultants.booking_state} = 'bookable_with_slots' then 1 else 0 end)`,
      needsReview: sql<number>`sum(case when ${consultants.manually_reviewed} = 0 and ${REVIEW_QUEUE_RULE} then 1 else 0 end)`,
      avgPlainEnglish: sql<number>`coalesce(avg(${consultants.plain_english_score}), 0)`,
      missingPhotos: sql<number>`sum(case when ${consultants.has_photo} = 0 or ${consultants.has_photo} is null then 1 else 0 end)`,
      avgPrice: sql<number | null>`avg(${consultants.consultation_price})`,
    })
    .from(consultants)
    .where(eq(consultants.run_id, runId))
    .get();

  if (!row) {
    return {
      totalProfiles: 0,
      avgScore: 0,
      goldPct: 0,
      bookableCount: 0,
      needsReview: 0,
      avgPlainEnglish: 0,
      missingPhotos: 0,
      avgPrice: null,
    };
  }

  const total = row.totalProfiles || 1;
  return {
    totalProfiles: row.totalProfiles,
    avgScore: Math.round(row.avgScore * 10) / 10,
    goldPct: Math.round((row.goldCount / total) * 1000) / 10,
    bookableCount: row.bookableCount,
    needsReview: row.needsReview,
    avgPlainEnglish: Math.round(row.avgPlainEnglish * 10) / 10,
    missingPhotos: row.missingPhotos,
    avgPrice: row.avgPrice !== null ? Math.round(row.avgPrice * 100) / 100 : null,
  };
}

export interface QuickAction {
  description: string;
  profilesAffected: number;
  potentialUplift: number;
  totalImpact: number;
}

export function getQuickActions(runId: string): QuickAction[] {
  const actions: QuickAction[] = [];

  const counts = db
    .select({
      missingPhotos: sql<number>`sum(case when ${consultants.has_photo} = 0 or ${consultants.has_photo} is null then 1 else 0 end)`,
      thinBios: sql<number>`sum(case when ${consultants.bio_depth} = 'thin' then 1 else 0 end)`,
      missingBios: sql<number>`sum(case when ${consultants.bio_depth} = 'missing' then 1 else 0 end)`,
      missingInsurers: sql<number>`sum(case when ${consultants.insurer_count} = 0 or ${consultants.insurer_count} is null then 1 else 0 end)`,
      missingConsultationTimes: sql<number>`sum(case when json_array_length(${consultants.consultation_times_raw}) = 0 then 1 else 0 end)`,
      missingQualifications: sql<number>`sum(case when ${consultants.qualifications_credentials} is null then 1 else 0 end)`,
    })
    .from(consultants)
    .where(eq(consultants.run_id, runId))
    .get();

  if (!counts) return actions;

  if (counts.missingPhotos > 0) {
    actions.push({
      description: "Add profile photos",
      profilesAffected: counts.missingPhotos,
      potentialUplift: 10,
      totalImpact: counts.missingPhotos * 10,
    });
  }

  if (counts.missingBios > 0) {
    actions.push({
      description: "Write missing biographies",
      profilesAffected: counts.missingBios,
      potentialUplift: 15,
      totalImpact: counts.missingBios * 15,
    });
  }

  if (counts.thinBios > 0) {
    actions.push({
      description: "Expand thin biographies",
      profilesAffected: counts.thinBios,
      potentialUplift: 10,
      totalImpact: counts.thinBios * 10,
    });
  }

  if (counts.missingQualifications > 0) {
    actions.push({
      description: "Add qualifications and credentials",
      profilesAffected: counts.missingQualifications,
      potentialUplift: 10,
      totalImpact: counts.missingQualifications * 10,
    });
  }

  if (counts.missingInsurers > 0) {
    actions.push({
      description: "List accepted insurers",
      profilesAffected: counts.missingInsurers,
      potentialUplift: 8,
      totalImpact: counts.missingInsurers * 8,
    });
  }

  if (counts.missingConsultationTimes > 0) {
    actions.push({
      description: "Add consultation times",
      profilesAffected: counts.missingConsultationTimes,
      potentialUplift: 7,
      totalImpact: counts.missingConsultationTimes * 7,
    });
  }

  // Sort by total impact descending, take top 5
  actions.sort((a, b) => b.totalImpact - a.totalImpact);
  return actions.slice(0, 5);
}

export interface HospitalLeaderboardEntry {
  hospitalName: string;
  consultantCount: number;
  avgScore: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  incompleteCount: number;
}

export function getHospitalLeaderboard(runId: string): HospitalLeaderboardEntry[] {
  const rows = db
    .select({
      hospitalName: consultants.hospital_name_primary,
      consultantCount: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${consultants.profile_completeness_score})`,
      goldCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Gold' then 1 else 0 end)`,
      silverCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Silver' then 1 else 0 end)`,
      bronzeCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Bronze' then 1 else 0 end)`,
      incompleteCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Incomplete' then 1 else 0 end)`,
    })
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), sql`${consultants.hospital_name_primary} is not null`))
    .groupBy(consultants.hospital_name_primary)
    .orderBy(sql`avg(${consultants.profile_completeness_score}) desc`)
    .limit(10)
    .all();

  return rows.map((row) => ({
    hospitalName: row.hospitalName ?? "Unknown",
    consultantCount: row.consultantCount,
    avgScore: Math.round(row.avgScore * 10) / 10,
    goldCount: row.goldCount,
    silverCount: row.silverCount,
    bronzeCount: row.bronzeCount,
    incompleteCount: row.incompleteCount,
  }));
}

// Get total count for a run (for pagination)
export function getConsultantCount(runId: string, filters?: ConsultantFilters) {
  const conditions = buildFilterConditions(runId, filters);

  return db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(consultants)
    .where(and(...conditions))
    .then((rows) => rows[0]?.count ?? 0);
}

// Get filter counts for sidebar badges
export async function getFilterCounts(runId: string): Promise<FilterCounts> {
  const baseCondition = eq(consultants.run_id, runId);

  const [tierRows, bookingRows, hospitalRows, specialtyRows, bioRows, photoRows, flagRows] = await Promise.all([
    db.select({
      quality_tier: consultants.quality_tier,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(consultants)
      .where(baseCondition)
      .groupBy(consultants.quality_tier),

    db.select({
      booking_state: consultants.booking_state,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(consultants)
      .where(baseCondition)
      .groupBy(consultants.booking_state),

    db.select({
      name: consultants.hospital_name_primary,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(consultants)
      .where(and(baseCondition, sql`${consultants.hospital_name_primary} IS NOT NULL`))
      .groupBy(consultants.hospital_name_primary)
      .orderBy(sql`count(*) DESC`)
      .limit(200),

    db.all<{ name: string; count: number }>(
      sql`SELECT j.value as name, count(*) as count
          FROM consultants, json_each(consultants.specialty_primary) AS j
          WHERE consultants.run_id = ${runId}
          GROUP BY j.value
          ORDER BY count(*) DESC
          LIMIT 200`
    ),

    db.select({
      bio_depth: consultants.bio_depth,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(consultants)
      .where(baseCondition)
      .groupBy(consultants.bio_depth),

    db.select({
      has_photo: consultants.has_photo,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(consultants)
      .where(baseCondition)
      .groupBy(consultants.has_photo),

    db.all<{ severity: string; count: number }>(
      sql`SELECT json_extract(j.value, '$.severity') as severity, count(DISTINCT consultants.slug) as count
          FROM consultants, json_each(consultants.flags) AS j
          WHERE consultants.run_id = ${runId}
          GROUP BY json_extract(j.value, '$.severity')`
    ),
  ]);

  const tiers: Record<string, number> = {};
  for (const row of tierRows) {
    if (row.quality_tier) tiers[row.quality_tier] = row.count;
  }

  const booking_states: Record<string, number> = {};
  for (const row of bookingRows) {
    if (row.booking_state) booking_states[row.booking_state] = row.count;
  }

  const hospitals = hospitalRows
    .filter((r): r is { name: string; count: number } => r.name !== null)
    .map((r) => ({ name: r.name, count: r.count }));

  const specialties = specialtyRows.map((r) => ({ name: r.name, count: r.count }));

  const bio_depths: Record<string, number> = {};
  for (const row of bioRows) {
    if (row.bio_depth) bio_depths[row.bio_depth] = row.count;
  }

  let photoHas = 0;
  let photoMissing = 0;
  for (const row of photoRows) {
    if (row.has_photo) photoHas = row.count;
    else photoMissing = row.count;
  }

  const flags: { fail: number; warn: number } = { fail: 0, warn: 0 };
  for (const row of flagRows) {
    if (row.severity === "fail") flags.fail = row.count;
    if (row.severity === "warn") flags.warn = row.count;
  }

  return {
    tiers,
    booking_states,
    hospitals,
    specialties,
    bio_depths,
    photo: { has: photoHas, missing: photoMissing },
    flags,
  };
}

// Get specialty average score for comparison
export function getSpecialtyAverageScore(runId: string, specialty: string) {
  const rows = db.all<{ avg_score: number; count: number }>(
    sql`SELECT AVG(profile_completeness_score) as avg_score, count(*) as count
        FROM consultants, json_each(consultants.specialty_primary) AS j
        WHERE consultants.run_id = ${runId}
          AND j.value = ${specialty}
          AND consultants.profile_completeness_score IS NOT NULL`
  );
  return rows[0] ?? { avg_score: 0, count: 0 };
}

// ============================================================
// Hospital Benchmarking Queries
// ============================================================

export interface HospitalBenchmark {
  hospitalName: string;
  consultantCount: number;
  avgScore: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  incompleteCount: number;
  goldPct: number;
  photoPct: number;
  bioQualityPct: number;
  bookablePct: number;
  avgPlainEnglish: number;
  insurerPct: number;
  topSpecialty: string | null;
}

export function getHospitalBenchmarks(runId: string): HospitalBenchmark[] {
  const rows = db
    .select({
      hospitalName: consultants.hospital_name_primary,
      consultantCount: sql<number>`count(*)`,
      avgScore: sql<number>`coalesce(avg(${consultants.profile_completeness_score}), 0)`,
      goldCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Gold' then 1 else 0 end)`,
      silverCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Silver' then 1 else 0 end)`,
      bronzeCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Bronze' then 1 else 0 end)`,
      incompleteCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Incomplete' then 1 else 0 end)`,
      photoPct: sql<number>`coalesce(avg(case when ${consultants.has_photo} = 1 then 100.0 else 0.0 end), 0)`,
      bioQualityPct: sql<number>`coalesce(avg(case when ${consultants.bio_depth} in ('substantive', 'adequate') then 100.0 else 0.0 end), 0)`,
      bookablePct: sql<number>`coalesce(avg(case when ${consultants.booking_state} = 'bookable_with_slots' then 100.0 else 0.0 end), 0)`,
      avgPlainEnglish: sql<number>`coalesce(avg(${consultants.plain_english_score}), 0)`,
      insurerPct: sql<number>`coalesce(avg(case when ${consultants.insurer_count} > 0 then 100.0 else 0.0 end), 0)`,
    })
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), sql`${consultants.hospital_name_primary} is not null`))
    .groupBy(consultants.hospital_name_primary)
    .orderBy(sql`avg(${consultants.profile_completeness_score}) desc`)
    .all();

  // Get top specialty per hospital using json_each
  const topSpecRows = db.all<{ hospitalName: string; specialty: string; cnt: number }>(
    sql`SELECT c.hospital_name_primary as hospitalName, je.value as specialty, count(*) as cnt
        FROM ${consultants} c, json_each(c.specialty_primary) as je
        WHERE c.run_id = ${runId} AND c.hospital_name_primary IS NOT NULL
        GROUP BY c.hospital_name_primary, je.value
        ORDER BY c.hospital_name_primary, cnt DESC`
  );

  const topSpecMap = new Map<string, string>();
  for (const row of topSpecRows) {
    if (!topSpecMap.has(row.hospitalName)) {
      topSpecMap.set(row.hospitalName, row.specialty);
    }
  }

  return rows.map((row) => {
    const total = row.consultantCount || 1;
    return {
      hospitalName: row.hospitalName ?? "Unknown",
      consultantCount: row.consultantCount,
      avgScore: Math.round(row.avgScore * 10) / 10,
      goldCount: row.goldCount,
      silverCount: row.silverCount,
      bronzeCount: row.bronzeCount,
      incompleteCount: row.incompleteCount,
      goldPct: Math.round((row.goldCount / total) * 1000) / 10,
      photoPct: Math.round(row.photoPct * 10) / 10,
      bioQualityPct: Math.round(row.bioQualityPct * 10) / 10,
      bookablePct: Math.round(row.bookablePct * 10) / 10,
      avgPlainEnglish: Math.round(row.avgPlainEnglish * 10) / 10,
      insurerPct: Math.round(row.insurerPct * 10) / 10,
      topSpecialty: topSpecMap.get(row.hospitalName ?? "") ?? null,
    };
  });
}

// ============================================================
// Specialty Analysis Queries
// ============================================================

export interface SpecialtyBenchmark {
  specialty: string;
  consultantCount: number;
  avgScore: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  incompleteCount: number;
  photoPct: number;
  bioQualityPct: number;
  bookablePct: number;
  avgPlainEnglish: number;
  insurerPct: number;
  commonFlags: { code: string; count: number }[];
}

export function getSpecialtyAnalysis(runId: string): SpecialtyBenchmark[] {
  const rows = db.all<{
    specialty: string;
    consultantCount: number;
    avgScore: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    incompleteCount: number;
    photoPct: number;
    bioQualityPct: number;
    bookablePct: number;
    avgPlainEnglish: number;
    insurerPct: number;
  }>(
    sql`SELECT
          je.value as specialty,
          count(*) as consultantCount,
          coalesce(avg(c.profile_completeness_score), 0) as avgScore,
          sum(case when c.quality_tier = 'Gold' then 1 else 0 end) as goldCount,
          sum(case when c.quality_tier = 'Silver' then 1 else 0 end) as silverCount,
          sum(case when c.quality_tier = 'Bronze' then 1 else 0 end) as bronzeCount,
          sum(case when c.quality_tier = 'Incomplete' then 1 else 0 end) as incompleteCount,
          coalesce(avg(case when c.has_photo = 1 then 100.0 else 0.0 end), 0) as photoPct,
          coalesce(avg(case when c.bio_depth in ('substantive', 'adequate') then 100.0 else 0.0 end), 0) as bioQualityPct,
          coalesce(avg(case when c.booking_state = 'bookable_with_slots' then 100.0 else 0.0 end), 0) as bookablePct,
          coalesce(avg(c.plain_english_score), 0) as avgPlainEnglish,
          coalesce(avg(case when c.insurer_count > 0 then 100.0 else 0.0 end), 0) as insurerPct
        FROM ${consultants} c, json_each(c.specialty_primary) as je
        WHERE c.run_id = ${runId}
        GROUP BY je.value
        ORDER BY count(*) DESC`
  );

  // Get flag frequencies per specialty (top 3 per specialty)
  const flagRows = db.all<{ specialty: string; flagCode: string; cnt: number }>(
    sql`SELECT je.value as specialty, json_extract(fe.value, '$.code') as flagCode, count(*) as cnt
        FROM ${consultants} c, json_each(c.specialty_primary) as je, json_each(c.flags) as fe
        WHERE c.run_id = ${runId}
        GROUP BY je.value, json_extract(fe.value, '$.code')
        ORDER BY je.value, cnt DESC`
  );

  const flagMap = new Map<string, { code: string; count: number }[]>();
  for (const row of flagRows) {
    if (!flagMap.has(row.specialty)) {
      flagMap.set(row.specialty, []);
    }
    const arr = flagMap.get(row.specialty)!;
    if (arr.length < 3) {
      arr.push({ code: row.flagCode, count: row.cnt });
    }
  }

  return rows.map((row) => ({
    specialty: row.specialty,
    consultantCount: row.consultantCount,
    avgScore: Math.round(row.avgScore * 10) / 10,
    goldCount: row.goldCount,
    silverCount: row.silverCount,
    bronzeCount: row.bronzeCount,
    incompleteCount: row.incompleteCount,
    photoPct: Math.round(row.photoPct * 10) / 10,
    bioQualityPct: Math.round(row.bioQualityPct * 10) / 10,
    bookablePct: Math.round(row.bookablePct * 10) / 10,
    avgPlainEnglish: Math.round(row.avgPlainEnglish * 10) / 10,
    insurerPct: Math.round(row.insurerPct * 10) / 10,
    commonFlags: flagMap.get(row.specialty) ?? [],
  }));
}

// ============================================================
// Action Centre Queries
// ============================================================

export interface ActionItem {
  rank: number;
  action: string;
  description: string;
  profilesAffected: number;
  pointsPerProfile: number;
  totalImpact: number;
  filterParam: string;
}

export interface ImpactSummary {
  currentAvgScore: number;
  projectedAvgScore: number;
  currentGoldPct: number;
  projectedGoldPct: number;
  totalProfiles: number;
}

export interface ReportProfileRow {
  consultantName: string;
  slug: string;
  hospitalName: string;
  qualityTier: string | null;
  score: number | null;
  bookingState: string | null;
  hasPhoto: boolean | null;
  bioDepth: string | null;
  insurerCount: number | null;
  plainEnglishScore: number | null;
}

export function getActionCentreData(runId: string): ActionItem[] {
  const counts = db
    .select({
      total: sql<number>`count(*)`,
      missingPhotos: sql<number>`sum(case when ${consultants.has_photo} = 0 or ${consultants.has_photo} is null then 1 else 0 end)`,
      thinMissingBios: sql<number>`sum(case when ${consultants.bio_depth} in ('thin', 'missing') then 1 else 0 end)`,
      missingInsurers: sql<number>`sum(case when ${consultants.insurer_count} = 0 or ${consultants.insurer_count} is null then 1 else 0 end)`,
      missingConsultationTimes: sql<number>`sum(case when ${consultants.consultation_times_raw} is null or json_array_length(${consultants.consultation_times_raw}) = 0 then 1 else 0 end)`,
      missingQualifications: sql<number>`sum(case when ${consultants.qualifications_credentials} is null then 1 else 0 end)`,
      missingMemberships: sql<number>`sum(case when ${consultants.memberships} is null or json_array_length(${consultants.memberships}) = 0 then 1 else 0 end)`,
    })
    .from(consultants)
    .where(eq(consultants.run_id, runId))
    .get();

  if (!counts) return [];

  const actions: ActionItem[] = [];

  if (counts.missingPhotos > 0) {
    actions.push({
      rank: 0,
      action: "Add missing photos",
      description: "Upload profile photos for consultants without one. Each photo adds 10 points.",
      profilesAffected: counts.missingPhotos,
      pointsPerProfile: 10,
      totalImpact: counts.missingPhotos * 10,
      filterParam: "has_photo=false",
    });
  }

  if (counts.thinMissingBios > 0) {
    actions.push({
      rank: 0,
      action: "Expand thin/missing biographies",
      description: "Write or expand consultant biographies. Substantive bios add up to 15 points.",
      profilesAffected: counts.thinMissingBios,
      pointsPerProfile: 12.5,
      totalImpact: counts.thinMissingBios * 12.5,
      filterParam: "bio_depth=thin",
    });
  }

  if (counts.missingInsurers > 0) {
    actions.push({
      rank: 0,
      action: "List accepted insurers",
      description: "Add insurer panel information. Each complete listing adds 8 points.",
      profilesAffected: counts.missingInsurers,
      pointsPerProfile: 8,
      totalImpact: counts.missingInsurers * 8,
      filterParam: "score_max=92",
    });
  }

  if (counts.missingConsultationTimes > 0) {
    actions.push({
      rank: 0,
      action: "Add consultation times",
      description: "Publish available consultation times. Adds 7 points per profile.",
      profilesAffected: counts.missingConsultationTimes,
      pointsPerProfile: 7,
      totalImpact: counts.missingConsultationTimes * 7,
      filterParam: "score_max=93",
    });
  }

  if (counts.missingQualifications > 0) {
    actions.push({
      rank: 0,
      action: "Add qualifications and credentials",
      description: "List qualifications and credentials. Adds 10 points per profile.",
      profilesAffected: counts.missingQualifications,
      pointsPerProfile: 10,
      totalImpact: counts.missingQualifications * 10,
      filterParam: "score_max=90",
    });
  }

  if (counts.missingMemberships > 0) {
    actions.push({
      rank: 0,
      action: "Add professional memberships",
      description: "List professional body memberships. Adds 5 points per profile.",
      profilesAffected: counts.missingMemberships,
      pointsPerProfile: 5,
      totalImpact: counts.missingMemberships * 5,
      filterParam: "score_max=95",
    });
  }

  actions.sort((a, b) => b.totalImpact - a.totalImpact);
  actions.forEach((a, i) => (a.rank = i + 1));

  return actions;
}

export function getImpactSummary(runId: string): ImpactSummary {
  const row = db
    .select({
      totalProfiles: sql<number>`count(*)`,
      avgScore: sql<number>`coalesce(avg(${consultants.profile_completeness_score}), 0)`,
      goldCount: sql<number>`sum(case when ${consultants.quality_tier} = 'Gold' then 1 else 0 end)`,
      totalScoreSum: sql<number>`coalesce(sum(${consultants.profile_completeness_score}), 0)`,
      photoPoints: sql<number>`sum(case when ${consultants.has_photo} = 0 or ${consultants.has_photo} is null then 10 else 0 end)`,
      bioPoints: sql<number>`sum(case when ${consultants.bio_depth} = 'missing' then 15 when ${consultants.bio_depth} = 'thin' then 10 else 0 end)`,
      insurerPoints: sql<number>`sum(case when ${consultants.insurer_count} = 0 or ${consultants.insurer_count} is null then 8 else 0 end)`,
      consultTimesPoints: sql<number>`sum(case when ${consultants.consultation_times_raw} is null or json_array_length(${consultants.consultation_times_raw}) = 0 then 7 else 0 end)`,
      qualPoints: sql<number>`sum(case when ${consultants.qualifications_credentials} is null then 10 else 0 end)`,
      membershipPoints: sql<number>`sum(case when ${consultants.memberships} is null or json_array_length(${consultants.memberships}) = 0 then 5 else 0 end)`,
    })
    .from(consultants)
    .where(eq(consultants.run_id, runId))
    .get();

  if (!row || row.totalProfiles === 0) {
    return {
      currentAvgScore: 0,
      projectedAvgScore: 0,
      currentGoldPct: 0,
      projectedGoldPct: 0,
      totalProfiles: 0,
    };
  }

  const total = row.totalProfiles;
  const totalRecoverable =
    row.photoPoints + row.bioPoints + row.insurerPoints +
    row.consultTimesPoints + row.qualPoints + row.membershipPoints;
  const projectedTotalScore = row.totalScoreSum + totalRecoverable;
  const projectedAvg = projectedTotalScore / total;

  // Count profiles that would reach Gold (>=80) if all actions taken
  const projectedGoldCount = db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(consultants)
    .where(
      and(
        eq(consultants.run_id, runId),
        sql`(coalesce(${consultants.profile_completeness_score}, 0)
          + (case when ${consultants.has_photo} = 0 or ${consultants.has_photo} is null then 10 else 0 end)
          + (case when ${consultants.bio_depth} = 'missing' then 15 when ${consultants.bio_depth} = 'thin' then 10 else 0 end)
          + (case when ${consultants.insurer_count} = 0 or ${consultants.insurer_count} is null then 8 else 0 end)
          + (case when ${consultants.consultation_times_raw} is null or json_array_length(${consultants.consultation_times_raw}) = 0 then 7 else 0 end)
          + (case when ${consultants.qualifications_credentials} is null then 10 else 0 end)
          + (case when ${consultants.memberships} is null or json_array_length(${consultants.memberships}) = 0 then 5 else 0 end)
        ) >= 80`
      )
    )
    .get();

  return {
    currentAvgScore: Math.round(row.avgScore * 10) / 10,
    projectedAvgScore: Math.round(projectedAvg * 10) / 10,
    currentGoldPct: Math.round((row.goldCount / total) * 1000) / 10,
    projectedGoldPct: Math.round(((projectedGoldCount?.count ?? row.goldCount) / total) * 1000) / 10,
    totalProfiles: total,
  };
}

export function getTopPerformers(runId: string, limit = 5): ReportProfileRow[] {
  const rows = db
    .select({
      consultantName: consultants.consultant_name,
      slug: consultants.slug,
      hospitalName: consultants.hospital_name_primary,
      qualityTier: consultants.quality_tier,
      score: consultants.profile_completeness_score,
      bookingState: consultants.booking_state,
      hasPhoto: consultants.has_photo,
      bioDepth: consultants.bio_depth,
      insurerCount: consultants.insurer_count,
      plainEnglishScore: consultants.plain_english_score,
    })
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), sql`${consultants.profile_completeness_score} is not null`))
    .orderBy(desc(consultants.profile_completeness_score), asc(consultants.consultant_name))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    consultantName: row.consultantName ?? "Unknown",
    slug: row.slug,
    hospitalName: row.hospitalName ?? "Unknown",
    qualityTier: row.qualityTier,
    score: row.score !== null ? Math.round(row.score * 10) / 10 : null,
    bookingState: row.bookingState,
    hasPhoto: row.hasPhoto,
    bioDepth: row.bioDepth,
    insurerCount: row.insurerCount,
    plainEnglishScore: row.plainEnglishScore,
  }));
}

export function getAtRiskProfiles(runId: string, limit = 8): ReportProfileRow[] {
  const rows = db
    .select({
      consultantName: consultants.consultant_name,
      slug: consultants.slug,
      hospitalName: consultants.hospital_name_primary,
      qualityTier: consultants.quality_tier,
      score: consultants.profile_completeness_score,
      bookingState: consultants.booking_state,
      hasPhoto: consultants.has_photo,
      bioDepth: consultants.bio_depth,
      insurerCount: consultants.insurer_count,
      plainEnglishScore: consultants.plain_english_score,
    })
    .from(consultants)
    .where(eq(consultants.run_id, runId))
    .orderBy(
      sql`case
        when ${consultants.quality_tier} = 'Incomplete' then 0
        when ${consultants.quality_tier} = 'Bronze' then 1
        when ${consultants.quality_tier} = 'Silver' then 2
        when ${consultants.quality_tier} = 'Gold' then 3
        else 4
      end`,
      asc(consultants.profile_completeness_score),
      asc(consultants.consultant_name)
    )
    .limit(limit)
    .all();

  return rows.map((row) => ({
    consultantName: row.consultantName ?? "Unknown",
    slug: row.slug,
    hospitalName: row.hospitalName ?? "Unknown",
    qualityTier: row.qualityTier,
    score: row.score !== null ? Math.round(row.score * 10) / 10 : null,
    bookingState: row.bookingState,
    hasPhoto: row.hasPhoto,
    bioDepth: row.bioDepth,
    insurerCount: row.insurerCount,
    plainEnglishScore: row.plainEnglishScore,
  }));
}

// Get list of unique hospitals for filter dropdowns
export function getHospitalList(runId: string): string[] {
  const rows = db
    .select({ name: consultants.hospital_name_primary })
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), sql`${consultants.hospital_name_primary} is not null`))
    .groupBy(consultants.hospital_name_primary)
    .orderBy(consultants.hospital_name_primary)
    .all();
  return rows.map((r) => r.name!);
}

// Get list of unique specialties for filter dropdowns
export function getSpecialtyList(runId: string): string[] {
  const rows = db.all<{ specialty: string }>(
    sql`SELECT DISTINCT je.value as specialty
        FROM ${consultants} c, json_each(c.specialty_primary) as je
        WHERE c.run_id = ${runId}
        ORDER BY je.value`
  );
  return rows.map((r) => r.specialty);
}
