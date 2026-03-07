import { db } from "@/db/index";
import {
  bupaScrapeRuns,
  bupaConsultants,
  consultantMatches,
  consultants,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  ConsultantComparison,
  AggregateComparison,
  TopGap,
  MatchedPair,
  DimensionComparison,
} from "@/lib/bupa-types";
import type { QualityTier } from "@/lib/types";
import { SCORE_WEIGHTS, BUPA_UNAVAILABLE_POINTS } from "@/lib/config";

const MAX_BOOKING_POINTS = SCORE_WEIGHTS.booking_with_slots; // 10
const NUFFIELD_ADJUSTED_DENOMINATOR = 100 - MAX_BOOKING_POINTS; // 90
const BUPA_ADJUSTED_DENOMINATOR = 100 - BUPA_UNAVAILABLE_POINTS; // 70
const MATCH_CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

let bupaSchemaAvailable: boolean | null = null;

function excludePilotRuns() {
  return sql`${bupaScrapeRuns.run_id} NOT LIKE 'pilot-%'`;
}

async function hasBupaSchema(): Promise<boolean> {
  if (bupaSchemaAvailable === true) {
    return true;
  }

  // Don't cache failures — a transient error shouldn't permanently disable BUPA queries
  try {
    await db
      .select({ run_id: bupaScrapeRuns.run_id })
      .from(bupaScrapeRuns)
      .limit(1);

    bupaSchemaAvailable = true;
    return true;
  } catch {
    // Table doesn't exist or query failed — not cached so next request retries
    return false;
  }
}

function logBupaQueryError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[BUPA DB] ${scope} unavailable: ${message}`);
}

type MatchLike = {
  nuffield_slug: string;
  bupa_id: string;
  match_confidence: string;
  matched_at: string;
};

function pickPreferredMatch<T extends MatchLike>(current: T | undefined, candidate: T): T {
  if (!current) return candidate;

  const currentConfidence = MATCH_CONFIDENCE_RANK[current.match_confidence] ?? 0;
  const candidateConfidence = MATCH_CONFIDENCE_RANK[candidate.match_confidence] ?? 0;
  if (candidateConfidence !== currentConfidence) {
    return candidateConfidence > currentConfidence ? candidate : current;
  }

  return candidate.matched_at > current.matched_at ? candidate : current;
}

function dedupeMatchRows<T extends MatchLike>(rows: T[]): T[] {
  const deduped = new Map<string, T>();

  for (const row of rows) {
    deduped.set(
      row.nuffield_slug,
      pickPreferredMatch(deduped.get(row.nuffield_slug), row)
    );
  }

  return [...deduped.values()];
}

// Compute adjusted score excluding booking dimension
function computeNuffieldAdjusted(
  rawScore: number | null,
  bookingState: string | null
): number | null {
  if (rawScore == null) return null;
  let bookingEarned = 0;
  if (bookingState === "bookable_with_slots") {
    bookingEarned = SCORE_WEIGHTS.booking_with_slots;
  } else if (bookingState === "bookable_no_slots") {
    bookingEarned = SCORE_WEIGHTS.booking_no_slots;
  }
  return ((rawScore - bookingEarned) / NUFFIELD_ADJUSTED_DENOMINATOR) * 100;
}

function computeBupaAdjusted(rawScore: number | null): number | null {
  if (rawScore == null) return null;
  return (rawScore / BUPA_ADJUSTED_DENOMINATOR) * 100;
}

// Get the latest completed BUPA run.
// Prefers full (non-pilot) runs; falls back to pilot if no full run exists.
export async function getLatestBupaRun(includePilotRuns = false) {
  if (!(await hasBupaSchema())) return null;

  try {
    // Try full runs first
    const fullRun = await db
      .select()
      .from(bupaScrapeRuns)
      .where(and(eq(bupaScrapeRuns.status, "completed"), excludePilotRuns()))
      .orderBy(desc(bupaScrapeRuns.started_at))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (fullRun) return fullRun;

    // Fall back to pilot runs if allowed and no full run exists
    if (!includePilotRuns) return null;

    return await db
      .select()
      .from(bupaScrapeRuns)
      .where(eq(bupaScrapeRuns.status, "completed"))
      .orderBy(desc(bupaScrapeRuns.started_at))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  } catch (error) {
    logBupaQueryError("getLatestBupaRun", error);
    return null;
  }
}

export async function getBupaRunById(runId: string) {
  if (!(await hasBupaSchema())) return null;

  try {
    return await db
      .select()
      .from(bupaScrapeRuns)
      .where(eq(bupaScrapeRuns.run_id, runId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  } catch (error) {
    logBupaQueryError("getBupaRunById", error);
    return null;
  }
}

// Get all BUPA runs ordered by date
export async function getBupaRunHistory(includePilotRuns = false) {
  if (!(await hasBupaSchema())) return [];

  try {
    const query = db
      .select()
      .from(bupaScrapeRuns)
      .$dynamic();

    return await (includePilotRuns ? query : query.where(excludePilotRuns()))
      .orderBy(desc(bupaScrapeRuns.started_at));
  } catch (error) {
    logBupaQueryError("getBupaRunHistory", error);
    return [];
  }
}

// Get match record for a Nuffield consultant
export async function getBupaMatchForConsultant(nuffieldSlug: string, bupaRunId?: string) {
  if (!(await hasBupaSchema())) return null;

  try {
    const query = db
      .select({
        match_id: consultantMatches.match_id,
        nuffield_slug: consultantMatches.nuffield_slug,
        bupa_id: consultantMatches.bupa_id,
        match_method: consultantMatches.match_method,
        match_confidence: consultantMatches.match_confidence,
        registration_number: consultantMatches.registration_number,
        matched_at: consultantMatches.matched_at,
      })
      .from(consultantMatches)
      .$dynamic();

    const rows = await (bupaRunId
      ? query
          .innerJoin(
            bupaConsultants,
            and(
              eq(bupaConsultants.bupa_id, consultantMatches.bupa_id),
              eq(bupaConsultants.run_id, bupaRunId)
            )
          )
          .where(eq(consultantMatches.nuffield_slug, nuffieldSlug))
      : query.where(eq(consultantMatches.nuffield_slug, nuffieldSlug)))
      .then((rows) => dedupeMatchRows(rows));

    return rows[0] ?? null;
  } catch (error) {
    logBupaQueryError("getBupaMatchForConsultant", error);
    return null;
  }
}

// Get a single BUPA consultant record
export async function getBupaConsultant(bupaId: string, runId: string) {
  if (!(await hasBupaSchema())) return null;

  try {
    return await db
      .select()
      .from(bupaConsultants)
      .where(
        and(
          eq(bupaConsultants.bupa_id, bupaId),
          eq(bupaConsultants.run_id, runId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
  } catch (error) {
    logBupaQueryError("getBupaConsultant", error);
    return null;
  }
}

// Build per-dimension comparisons between Nuffield and BUPA profiles
function buildDimensionComparisons(
  nuffield: typeof consultants.$inferSelect,
  bupa: typeof bupaConsultants.$inferSelect
): DimensionComparison[] {
  const dims: DimensionComparison[] = [];

  // Photo
  dims.push({
    dimension: "photo",
    label: "Profile Photo",
    nuffield_value: nuffield.has_photo ?? null,
    bupa_value: bupa.has_photo ?? null,
    winner: compareBool(nuffield.has_photo, bupa.has_photo),
  });

  // Bio depth
  const bioRank: Record<string, number> = {
    substantive: 3,
    adequate: 2,
    thin: 1,
    missing: 0,
  };
  dims.push({
    dimension: "bio_depth",
    label: "Bio Depth",
    nuffield_value: nuffield.bio_depth,
    bupa_value: bupa.bio_depth,
    winner: compareRanked(
      nuffield.bio_depth ? bioRank[nuffield.bio_depth] : null,
      bupa.bio_depth ? bioRank[bupa.bio_depth] : null
    ),
  });

  // Treatments count
  const nTreatments = nuffield.treatments?.length ?? 0;
  const bTreatments = bupa.treatments?.length ?? 0;
  dims.push({
    dimension: "treatments_count",
    label: "Treatments Listed",
    nuffield_value: nTreatments,
    bupa_value: bTreatments,
    winner: compareNum(nTreatments, bTreatments),
  });

  // Qualifications present
  const nQual = nuffield.qualifications_credentials != null;
  const bQual = bupa.qualifications_credentials != null;
  dims.push({
    dimension: "qualifications_present",
    label: "Qualifications",
    nuffield_value: nQual,
    bupa_value: bQual,
    winner: compareBool(nQual, bQual),
  });

  // Specialties count
  const nSpecs = (nuffield.specialty_primary?.length ?? 0) + (nuffield.specialty_sub?.length ?? 0);
  const bSpecs = (bupa.specialty_primary?.length ?? 0) + (bupa.specialty_sub?.length ?? 0);
  dims.push({
    dimension: "specialties_count",
    label: "Specialties Listed",
    nuffield_value: nSpecs,
    bupa_value: bSpecs,
    winner: compareNum(nSpecs, bSpecs),
  });

  // Plain English score — mark incomparable if BUPA assessment failed/skipped
  const bupaAssessmentFailed =
    bupa.plain_english_reason != null &&
    /AI assessment failed|skipped/i.test(bupa.plain_english_reason);
  dims.push({
    dimension: "plain_english_score",
    label: "Plain English Score",
    nuffield_value: nuffield.plain_english_score,
    bupa_value: bupaAssessmentFailed ? null : bupa.plain_english_score,
    winner: bupaAssessmentFailed
      ? "incomparable"
      : compareNum(nuffield.plain_english_score, bupa.plain_english_score),
  });

  // Memberships count
  const nMemberships = nuffield.memberships?.length ?? 0;
  const bMemberships = bupa.memberships?.length ?? 0;
  dims.push({
    dimension: "memberships_count",
    label: "Memberships Listed",
    nuffield_value: nMemberships,
    bupa_value: bMemberships,
    winner: compareNum(nMemberships, bMemberships),
  });

  return dims;
}

function compareBool(
  a: boolean | null | undefined,
  b: boolean | null | undefined
): DimensionComparison["winner"] {
  if (a == null && b == null) return "tie";
  if (a == null || b == null) return "incomparable";
  if (a === b) return "tie";
  return a ? "nuffield" : "bupa";
}

function compareNum(
  a: number | null | undefined,
  b: number | null | undefined
): DimensionComparison["winner"] {
  if (a == null && b == null) return "tie";
  if (a == null || b == null) return "incomparable";
  if (a === b) return "tie";
  return a > b ? "nuffield" : "bupa";
}

function compareRanked(
  a: number | null,
  b: number | null
): DimensionComparison["winner"] {
  if (a == null && b == null) return "tie";
  if (a == null || b == null) return "incomparable";
  if (a === b) return "tie";
  return a > b ? "nuffield" : "bupa";
}

// Full consultant-level comparison
export async function getConsultantComparison(
  nuffieldSlug: string,
  nuffieldRunId: string,
  bupaRunId: string
): Promise<ConsultantComparison | null> {
  if (!(await hasBupaSchema())) return null;

  const match = await getBupaMatchForConsultant(nuffieldSlug, bupaRunId);
  if (!match) return null;

  const [nuffieldRecord, bupaRecord] = await Promise.all([
    db
      .select()
      .from(consultants)
      .where(
        and(
          eq(consultants.slug, nuffieldSlug),
          eq(consultants.run_id, nuffieldRunId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getBupaConsultant(match.bupa_id, bupaRunId),
  ]);

  if (!nuffieldRecord || !bupaRecord) return null;

  const nuffieldAdjusted = computeNuffieldAdjusted(
    nuffieldRecord.profile_completeness_score,
    nuffieldRecord.booking_state
  );
  const bupaAdjusted = computeBupaAdjusted(
    bupaRecord.profile_completeness_score
  );

  return {
    nuffield_slug: nuffieldSlug,
    bupa_id: match.bupa_id,
    match_confidence: match.match_confidence,
    nuffield_name: nuffieldRecord.consultant_name,
    bupa_name: bupaRecord.consultant_name,
    nuffield_score: nuffieldRecord.profile_completeness_score,
    bupa_score: bupaRecord.profile_completeness_score,
    nuffield_adjusted_score: nuffieldAdjusted != null ? Math.round(nuffieldAdjusted * 10) / 10 : null,
    bupa_adjusted_score: bupaAdjusted != null ? Math.round(bupaAdjusted * 10) / 10 : null,
    nuffield_tier: nuffieldRecord.quality_tier as QualityTier | null,
    bupa_tier: bupaRecord.quality_tier as QualityTier | null,
    dimensions: buildDimensionComparisons(nuffieldRecord, bupaRecord),
    bupa_profile_url: bupaRecord.profile_url,
  };
}

// Aggregate comparison across all matched consultants
export async function getAggregateComparison(
  nuffieldRunId: string,
  bupaRunId: string
): Promise<AggregateComparison> {
  const emptyComparison: AggregateComparison = {
    total_nuffield: 0,
    matched_count: 0,
    nuffield_only_count: 0,
    match_rate: 0,
    nuffield_avg_score: null,
    bupa_avg_score: null,
    nuffield_avg_adjusted: null,
    bupa_avg_adjusted: null,
    nuffield_tiers: { Gold: 0, Silver: 0, Bronze: 0, Incomplete: 0 },
    bupa_tiers: { Gold: 0, Silver: 0, Bronze: 0, Incomplete: 0 },
    bupa_better_count: 0,
    nuffield_better_count: 0,
    tie_count: 0,
    dimension_wins: [],
  };

  if (!(await hasBupaSchema())) {
    return emptyComparison;
  }

  try {
    // Total Nuffield consultants in this run
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultants)
      .where(eq(consultants.run_id, nuffieldRunId));
    const totalNuffield = totalResult[0]?.count ?? 0;

    // Get all matches that have BUPA data in this run
    const matchedRows = dedupeMatchRows(
      await db
      .select({
        nuffield_slug: consultantMatches.nuffield_slug,
        bupa_id: consultantMatches.bupa_id,
        match_confidence: consultantMatches.match_confidence,
        matched_at: consultantMatches.matched_at,
      })
      .from(consultantMatches)
      .innerJoin(
        bupaConsultants,
        and(
          eq(bupaConsultants.bupa_id, consultantMatches.bupa_id),
          eq(bupaConsultants.run_id, bupaRunId)
        )
      )
    );

    const matchedSlugs = matchedRows.map((r) => r.nuffield_slug);
    const matchedCount = matchedSlugs.length;

    // Fetch matched consultant data from both sides
    const nuffieldTiers: Record<QualityTier, number> = { Gold: 0, Silver: 0, Bronze: 0, Incomplete: 0 };
    const bupaTiers: Record<QualityTier, number> = { Gold: 0, Silver: 0, Bronze: 0, Incomplete: 0 };

    let nuffieldScoreSum = 0;
    let bupaScoreSum = 0;
    let nuffieldAdjSum = 0;
    let bupaAdjSum = 0;
    let scoreCount = 0;

    let bupaBetterCount = 0;
    let nuffieldBetterCount = 0;
    let tieCount = 0;

    // Dimension win trackers
    const dimensionDefs = [
      { dimension: "photo", label: "Profile Photo" },
      { dimension: "bio_depth", label: "Bio Depth" },
      { dimension: "treatments_count", label: "Treatments Listed" },
      { dimension: "qualifications_present", label: "Qualifications" },
      { dimension: "specialties_count", label: "Specialties Listed" },
      { dimension: "plain_english_score", label: "Plain English Score" },
      { dimension: "memberships_count", label: "Memberships Listed" },
    ];
    const dimWins: Record<string, { bupa_wins: number; nuffield_wins: number; ties: number }> = {};
    for (const d of dimensionDefs) {
      dimWins[d.dimension] = { bupa_wins: 0, nuffield_wins: 0, ties: 0 };
    }

    // Process in batches to avoid too many queries
    for (const row of matchedRows) {
      const [nRec, bRec] = await Promise.all([
        db
          .select()
          .from(consultants)
          .where(
            and(
              eq(consultants.slug, row.nuffield_slug),
              eq(consultants.run_id, nuffieldRunId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(bupaConsultants)
          .where(
            and(
              eq(bupaConsultants.bupa_id, row.bupa_id),
              eq(bupaConsultants.run_id, bupaRunId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      if (!nRec || !bRec) continue;

      // Tiers
      if (nRec.quality_tier) nuffieldTiers[nRec.quality_tier as QualityTier]++;
      if (bRec.quality_tier) bupaTiers[bRec.quality_tier as QualityTier]++;

      // Scores
      const nAdj = computeNuffieldAdjusted(nRec.profile_completeness_score, nRec.booking_state);
      const bAdj = computeBupaAdjusted(bRec.profile_completeness_score);

      if (nRec.profile_completeness_score != null && bRec.profile_completeness_score != null && nAdj != null && bAdj != null) {
        nuffieldScoreSum += nRec.profile_completeness_score;
        bupaScoreSum += bRec.profile_completeness_score;
        nuffieldAdjSum += nAdj;
        bupaAdjSum += bAdj;
        scoreCount++;

        // Win/loss with 2-point dead zone
        const diff = bAdj - nAdj;
        if (diff > 2) bupaBetterCount++;
        else if (diff < -2) nuffieldBetterCount++;
        else tieCount++;
      }

      // Dimension wins
      const dims = buildDimensionComparisons(nRec, bRec);
      for (const dim of dims) {
        const tracker = dimWins[dim.dimension];
        if (!tracker) continue;
        if (dim.winner === "bupa") tracker.bupa_wins++;
        else if (dim.winner === "nuffield") tracker.nuffield_wins++;
        else if (dim.winner === "tie") tracker.ties++;
      }
    }

    return {
      total_nuffield: totalNuffield,
      matched_count: matchedCount,
      nuffield_only_count: totalNuffield - matchedCount,
      match_rate: totalNuffield > 0 ? matchedCount / totalNuffield : 0,

      nuffield_avg_score: scoreCount > 0 ? Math.round((nuffieldScoreSum / scoreCount) * 10) / 10 : null,
      bupa_avg_score: scoreCount > 0 ? Math.round((bupaScoreSum / scoreCount) * 10) / 10 : null,
      nuffield_avg_adjusted: scoreCount > 0 ? Math.round((nuffieldAdjSum / scoreCount) * 10) / 10 : null,
      bupa_avg_adjusted: scoreCount > 0 ? Math.round((bupaAdjSum / scoreCount) * 10) / 10 : null,

      nuffield_tiers: nuffieldTiers,
      bupa_tiers: bupaTiers,

      bupa_better_count: bupaBetterCount,
      nuffield_better_count: nuffieldBetterCount,
      tie_count: tieCount,

      dimension_wins: dimensionDefs.map((d) => ({
        dimension: d.dimension,
        label: d.label,
        bupa_wins: dimWins[d.dimension].bupa_wins,
        nuffield_wins: dimWins[d.dimension].nuffield_wins,
        ties: dimWins[d.dimension].ties,
      })),
    };
  } catch (error) {
    logBupaQueryError("getAggregateComparison", error);
    return {
      ...emptyComparison,
      total_nuffield: await db
        .select({ count: sql<number>`count(*)` })
        .from(consultants)
        .where(eq(consultants.run_id, nuffieldRunId))
        .then((rows) => rows[0]?.count ?? 0),
    };
  }
}

// Top gaps where BUPA beats Nuffield by adjusted score
export async function getTopGaps(
  nuffieldRunId: string,
  bupaRunId: string,
  limit = 20
): Promise<TopGap[]> {
  if (!(await hasBupaSchema())) return [];

  try {
    // Get all matches with BUPA data
    const matchedRows = dedupeMatchRows(
      await db
      .select({
        nuffield_slug: consultantMatches.nuffield_slug,
        bupa_id: consultantMatches.bupa_id,
        match_confidence: consultantMatches.match_confidence,
        matched_at: consultantMatches.matched_at,
      })
      .from(consultantMatches)
      .innerJoin(
        bupaConsultants,
        and(
          eq(bupaConsultants.bupa_id, consultantMatches.bupa_id),
          eq(bupaConsultants.run_id, bupaRunId)
        )
      )
    );

    const gaps: TopGap[] = [];

    for (const row of matchedRows) {
      const [nRec, bRec] = await Promise.all([
        db
          .select()
          .from(consultants)
          .where(
            and(
              eq(consultants.slug, row.nuffield_slug),
              eq(consultants.run_id, nuffieldRunId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(bupaConsultants)
          .where(
            and(
              eq(bupaConsultants.bupa_id, row.bupa_id),
              eq(bupaConsultants.run_id, bupaRunId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      if (!nRec || !bRec) continue;

      const nAdj = computeNuffieldAdjusted(nRec.profile_completeness_score, nRec.booking_state);
      const bAdj = computeBupaAdjusted(bRec.profile_completeness_score);

      if (nAdj == null || bAdj == null) continue;

      const gap = bAdj - nAdj;
      if (gap <= 0) continue;

      gaps.push({
        nuffield_slug: row.nuffield_slug,
        consultant_name: nRec.consultant_name,
        specialty_primary: nRec.specialty_primary ?? [],
        nuffield_adjusted: Math.round(nAdj * 10) / 10,
        bupa_adjusted: Math.round(bAdj * 10) / 10,
        gap: Math.round(gap * 10) / 10,
        bupa_profile_url: bRec.profile_url,
      });
    }

    // Sort by gap descending, take top N
    gaps.sort((a, b) => b.gap - a.gap);
    return gaps.slice(0, limit);
  } catch (error) {
    logBupaQueryError("getTopGaps", error);
    return [];
  }
}

// All matched pairs with both scores for comparison table
export async function getAllMatchedPairs(
  nuffieldRunId: string,
  bupaRunId: string
): Promise<MatchedPair[]> {
  if (!(await hasBupaSchema())) return [];

  try {
    const matchedRows = dedupeMatchRows(
      await db
        .select({
          nuffield_slug: consultantMatches.nuffield_slug,
          bupa_id: consultantMatches.bupa_id,
          match_confidence: consultantMatches.match_confidence,
          matched_at: consultantMatches.matched_at,
        })
        .from(consultantMatches)
        .innerJoin(
          bupaConsultants,
          and(
            eq(bupaConsultants.bupa_id, consultantMatches.bupa_id),
            eq(bupaConsultants.run_id, bupaRunId)
          )
        )
    );

    const pairs: MatchedPair[] = [];

    for (const row of matchedRows) {
      const [nRec, bRec] = await Promise.all([
        db
          .select()
          .from(consultants)
          .where(
            and(
              eq(consultants.slug, row.nuffield_slug),
              eq(consultants.run_id, nuffieldRunId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(bupaConsultants)
          .where(
            and(
              eq(bupaConsultants.bupa_id, row.bupa_id),
              eq(bupaConsultants.run_id, bupaRunId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      if (!nRec || !bRec) continue;

      const nAdj = computeNuffieldAdjusted(nRec.profile_completeness_score, nRec.booking_state);
      const bAdj = computeBupaAdjusted(bRec.profile_completeness_score);

      if (nAdj == null || bAdj == null) continue;

      const nAdjRound = Math.round(nAdj * 10) / 10;
      const bAdjRound = Math.round(bAdj * 10) / 10;
      const delta = Math.round((nAdj - bAdj) * 10) / 10;

      let winner: "nuffield" | "bupa" | "tie";
      if (delta > 2) winner = "nuffield";
      else if (delta < -2) winner = "bupa";
      else winner = "tie";

      pairs.push({
        nuffield_slug: row.nuffield_slug,
        consultant_name: nRec.consultant_name,
        specialty_primary: nRec.specialty_primary ?? [],
        nuffield_adjusted: nAdjRound,
        nuffield_tier: nRec.quality_tier as QualityTier | null,
        bupa_adjusted: bAdjRound,
        bupa_tier: bRec.quality_tier as QualityTier | null,
        delta,
        winner,
        bupa_profile_url: bRec.profile_url,
      });
    }

    pairs.sort((a, b) => a.delta - b.delta); // BUPA wins first
    return pairs;
  } catch (error) {
    logBupaQueryError("getAllMatchedPairs", error);
    return [];
  }
}

// Batch query: which slugs have a BUPA match?
export async function getBupaMatchedSlugs(slugs: string[]): Promise<Set<string>> {
  if (slugs.length === 0 || !(await hasBupaSchema())) return new Set();

  try {
    const rows = await db
      .select({ nuffield_slug: consultantMatches.nuffield_slug })
      .from(consultantMatches);

    const matchedSet = new Set(rows.map((r) => r.nuffield_slug));
    return new Set(slugs.filter((s) => matchedSet.has(s)));
  } catch (error) {
    logBupaQueryError("getBupaMatchedSlugs", error);
    return new Set();
  }
}
