import { randomUUID } from "crypto";
import { db } from "@/db/index";
import { bupaScrapeRuns, bupaConsultants, consultantMatches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  fetchBupaSitemapUrls,
  matchConsultants,
  normalizeRegistrationNumber,
  persistConsultantMatches,
} from "./discover-bupa";
import { launchBupaBrowser, fetchBupaProfile, applyBupaScrapeDelay } from "./crawl-bupa";
import { parseBupaProfile } from "./parse-bupa";
import { assessProfile } from "../assess";
import { scoreConsultant } from "../score";
import { logger } from "@/lib/logger";
import { SCORE_WEIGHTS, BUPA_UNAVAILABLE_POINTS } from "@/lib/config";
import type { BupaScrapeStatus } from "@/lib/bupa-types";
import type { BookingState } from "@/lib/types";
import { getLatestRun } from "@/db/queries";
import { heuristicBioDepth } from "../parse";

// ── CLI argument parsing ──────────────────────────────────────────────────────

interface CliArgs {
  resume: boolean;
  slug: string | null;
  discoverOnly: boolean;
  limit: number | null;
  skipAssess: boolean;
  pilot: boolean;
}

const MATCH_CONFIDENCE_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let resume = false;
  let slug: string | null = null;
  let discoverOnly = false;
  let limit: number | null = null;
  let skipAssess = false;
  let pilot = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--resume") {
      resume = true;
    } else if (args[i] === "--slug" && i + 1 < args.length) {
      slug = args[i + 1];
      i++;
    } else if (args[i] === "--discover-only") {
      discoverOnly = true;
    } else if (args[i] === "--limit" && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--skip-assess") {
      skipAssess = true;
    } else if (args[i] === "--pilot") {
      pilot = true;
    }
  }

  return { resume, slug, discoverOnly, limit, skipAssess, pilot };
}

// ── Database helpers ──────────────────────────────────────────────────────────

async function createBupaRun(runId: string, totalProfiles: number): Promise<void> {
  await db.insert(bupaScrapeRuns).values({
    run_id: runId,
    started_at: new Date().toISOString(),
    status: "running",
    total_profiles: totalProfiles,
    success_count: 0,
    error_count: 0,
    match_count: 0,
  }).run();
}

async function updateBupaRunStatus(
  runId: string,
  status: "completed" | "failed",
  successCount: number,
  errorCount: number,
  matchCount: number
): Promise<void> {
  await db.update(bupaScrapeRuns)
    .set({
      completed_at: new Date().toISOString(),
      status,
      success_count: successCount,
      error_count: errorCount,
      match_count: matchCount,
    })
    .where(eq(bupaScrapeRuns.run_id, runId))
    .run();
}

async function findLatestIncompleteBupaRun(): Promise<string | null> {
  const row = await db.select()
    .from(bupaScrapeRuns)
    .where(eq(bupaScrapeRuns.status, "running"))
    .orderBy(bupaScrapeRuns.started_at)
    .limit(1)
    .get();

  return row?.run_id ?? null;
}

function buildBupaRunId(pilot: boolean): string {
  const suffix = randomUUID();
  return pilot ? `pilot-${new Date().toISOString().replace(/[:.]/g, "-")}-${suffix}` : suffix;
}

async function upsertBupaConsultant(runId: string, bupaId: string, data: Record<string, unknown>): Promise<void> {
  const existing = await db.select()
    .from(bupaConsultants)
    .where(and(eq(bupaConsultants.run_id, runId), eq(bupaConsultants.bupa_id, bupaId)))
    .get();

  if (existing) {
    await db.update(bupaConsultants)
      .set(data)
      .where(and(eq(bupaConsultants.run_id, runId), eq(bupaConsultants.bupa_id, bupaId)))
      .run();
  } else {
    await db.insert(bupaConsultants)
      .values({
        run_id: runId,
        bupa_id: bupaId,
        bupa_slug: (data.bupa_slug as string) ?? bupaId,
        profile_url: (data.profile_url as string) ?? "",
        scrape_status: "pending",
        ...data,
      })
      .run();
  }
}

async function getBupaConsultantStatus(runId: string, bupaId: string): Promise<BupaScrapeStatus | null> {
  const row = await db.select({ scrape_status: bupaConsultants.scrape_status })
    .from(bupaConsultants)
    .where(and(eq(bupaConsultants.run_id, runId), eq(bupaConsultants.bupa_id, bupaId)))
    .get();

  return (row?.scrape_status as BupaScrapeStatus) ?? null;
}

// ── Adjusted score computation ────────────────────────────────────────────────

const MAX_BOOKING_POINTS = SCORE_WEIGHTS.booking_with_slots; // 10

function computeAdjustedScore(rawScore: number, bookingPointsEarned: number): number {
  const scoreWithoutBooking = rawScore - bookingPointsEarned;
  const maxWithoutBooking = 100 - BUPA_UNAVAILABLE_POINTS; // 70
  return Math.round((scoreWithoutBooking / maxWithoutBooking) * 100 * 10) / 10;
}

// ── Pipeline stages ───────────────────────────────────────────────────────────

function shouldSkipStage(currentStatus: BupaScrapeStatus | null, targetStage: BupaScrapeStatus): boolean {
  const progression: BupaScrapeStatus[] = [
    "pending", "crawl_done", "parse_done", "assess_done", "complete",
  ];
  if (!currentStatus || currentStatus === "error") return false;
  if (currentStatus === "complete") return true;

  const currentIdx = progression.indexOf(currentStatus);
  const targetIdx = progression.indexOf(targetStage);
  return currentIdx >= targetIdx;
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { resume, slug: singleSlug, discoverOnly, limit, skipAssess, pilot } = parseCliArgs();

  if (resume && pilot) {
    logger.error("BUPA", "init", "error", "--resume cannot be combined with --pilot");
    process.exit(1);
  }

  const modeDesc = resume ? "resume mode" : singleSlug ? `single: ${singleSlug}` : "full run";
  const flags = [
    discoverOnly && "discover-only",
    skipAssess && "skip-assess",
    pilot && "pilot",
    limit && `limit=${limit}`,
  ].filter(Boolean).join(", ");
  logger.info("BUPA", "init", "starting", flags ? `${modeDesc} (${flags})` : modeDesc);

  // Get latest Nuffield run for matching
  const nuffieldRun = await getLatestRun();
  if (!nuffieldRun) {
    logger.error("BUPA", "init", "error", "No Nuffield run found — run the Nuffield scraper first");
    process.exit(1);
  }
  logger.info("BUPA", "init", "nuffield", `using run_id=${nuffieldRun.run_id}`);

  // Step 1: Discover BUPA profiles via sitemap
  logger.info("BUPA", "discover", "starting", "Fetching BUPA sitemap...");
  const candidates = await fetchBupaSitemapUrls();
  logger.info("BUPA", "discover", "sitemap", `${candidates.length} BUPA profile URLs found`);

  // Step 2: Match candidates against Nuffield DB
  logger.info("BUPA", "match", "starting", "Matching against Nuffield consultants...");
  const matches = await matchConsultants(candidates, nuffieldRun.run_id, {
    persist: false,
  });
  logger.info("BUPA", "match", "done", `${matches.length} matches found from ${candidates.length} candidates`);

  if (discoverOnly) {
    // Log match summary and exit
    const highConf = matches.filter((m) => m.match_confidence === "high").length;
    const medConf = matches.filter((m) => m.match_confidence === "medium").length;
    const lowConf = matches.filter((m) => m.match_confidence === "low").length;
    logger.info("BUPA", "summary", "discover-only", `high=${highConf}, medium=${medConf}, low=${lowConf}`);
    return;
  }

  // Filter to single slug if specified
  let matchesToProcess = matches;
  if (singleSlug) {
    matchesToProcess = matches.filter((m) => m.nuffield_slug === singleSlug);
    if (matchesToProcess.length === 0) {
      logger.error("BUPA", "init", "error", `No BUPA match found for slug: ${singleSlug}`);
      process.exit(1);
    }
  }

  matchesToProcess = [...matchesToProcess].sort((left, right) => {
    const confidenceDelta =
      (MATCH_CONFIDENCE_ORDER[left.match_confidence] ?? 99) -
      (MATCH_CONFIDENCE_ORDER[right.match_confidence] ?? 99);
    if (confidenceDelta !== 0) return confidenceDelta;
    return left.nuffield_slug.localeCompare(right.nuffield_slug);
  });

  if (limit && limit > 0 && matchesToProcess.length > limit) {
    const fullCount = matchesToProcess.length;
    matchesToProcess = matchesToProcess.slice(0, limit);
    logger.info("BUPA", "init", "limited", `capped to ${limit} of ${fullCount} matches`);
  }

  await persistConsultantMatches(matchesToProcess, {
    clearSlugs: matchesToProcess.map((match) => match.nuffield_slug),
  });

  // Create or resume run
  let runId: string;
  if (resume) {
    const existingRunId = await findLatestIncompleteBupaRun();
    if (!existingRunId) {
      logger.error("BUPA", "init", "error", "No incomplete BUPA run found to resume");
      process.exit(1);
    }
    runId = existingRunId;
    logger.info("BUPA", "init", "resuming", `run_id=${runId}`);
  } else {
    runId = buildBupaRunId(pilot);
    await createBupaRun(runId, matchesToProcess.length);
  }

  const total = matchesToProcess.length;
  logger.info("BUPA", "init", "ready", `${total} profiles to scrape, run_id=${runId}`);

  // Build candidate lookup for URL resolution
  const candidateMap = new Map(candidates.map((c) => [c.bupa_id, c]));

  // Launch browser
  const browser = await launchBupaBrowser();

  let successCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < matchesToProcess.length; i++) {
      const match = matchesToProcess[i];
      const candidate = candidateMap.get(match.bupa_id);
      if (!candidate) {
        logger.error("BUPA", match.bupa_id, "error", "No candidate found for matched bupa_id");
        errorCount++;
        continue;
      }

      const progress = { current: i + 1, total };
      const bupaId = match.bupa_id;

      // Check current status for resume
      const currentStatus = await getBupaConsultantStatus(runId, bupaId);
      if (currentStatus === "complete") {
        successCount++;
        continue;
      }

      try {
        // STAGE 1: CRAWL
        let html: string | null = null;

        if (!shouldSkipStage(currentStatus, "crawl_done")) {
          try {
            const crawlResult = await fetchBupaProfile(browser, candidate.profile_url, bupaId, runId, progress);
            html = crawlResult.html;
            await upsertBupaConsultant(runId, bupaId, {
              bupa_slug: candidate.bupa_slug,
              profile_url: candidate.profile_url,
              scrape_status: "crawl_done",
            });
            await applyBupaScrapeDelay();
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error("BUPA", bupaId, "error", `crawl: ${msg}`, progress);
            await upsertBupaConsultant(runId, bupaId, {
              bupa_slug: candidate.bupa_slug,
              profile_url: candidate.profile_url,
              scrape_status: "error",
              scrape_error: `crawl: ${msg}`,
            });
            errorCount++;
            continue;
          }
        } else {
          // Read cached HTML for resume
          const { readFileSync } = await import("fs");
          const { join } = await import("path");
          const { BUPA_HTML_CACHE_PATH } = await import("@/lib/config");
          try {
            html = readFileSync(join(BUPA_HTML_CACHE_PATH, runId, `${bupaId}.html`), "utf-8");
          } catch {
            logger.error("BUPA", bupaId, "error", "Cannot read cached HTML for resume", progress);
            errorCount++;
            continue;
          }
        }

        // STAGE 2: PARSE
        let parsed;
        if (!shouldSkipStage(currentStatus, "parse_done")) {
          try {
            parsed = parseBupaProfile(html!, bupaId, candidate.bupa_slug, candidate.profile_url);

            await upsertBupaConsultant(runId, bupaId, {
              consultant_name: parsed.consultant_name,
              registration_number: parsed.registration_number,
              has_photo: parsed.has_photo,
              about_text: parsed.about_text,
              specialty_primary: parsed.specialty_primary,
              specialty_sub: parsed.specialty_sub,
              treatments: parsed.treatments,
              qualifications_credentials: parsed.qualifications_credentials,
              memberships: parsed.memberships,
              clinical_interests: parsed.clinical_interests,
              languages: parsed.languages,
              hospital_affiliations: parsed.hospital_affiliations,
              fee_assured: parsed.fee_assured,
              contact_phone_numbers: parsed.contact_phone_numbers,
              contact_email_addresses: parsed.contact_email_addresses,
              website_urls: parsed.website_urls,
              accreditation_badges: parsed.accreditation_badges,
              source_sections: parsed.source_sections,
              unmapped_section_keys: parsed.unmapped_section_keys,
              scrape_status: "parse_done",
            });

            const expectedRegistration = normalizeRegistrationNumber(match.registration_number);
            const parsedRegistration = normalizeRegistrationNumber(parsed.registration_number);

            if (
              expectedRegistration &&
              parsedRegistration &&
              expectedRegistration !== parsedRegistration
            ) {
              logger.warn(
                "BUPA",
                bupaId,
                "reg-mismatch",
                `nuffield=${expectedRegistration}, bupa=${parsedRegistration}`,
                progress
              );

              await db.delete(consultantMatches)
                .where(
                  and(
                    eq(consultantMatches.nuffield_slug, match.nuffield_slug),
                    eq(consultantMatches.bupa_id, bupaId)
                  )
                )
                .run();

              await db.delete(bupaConsultants)
                .where(and(eq(bupaConsultants.run_id, runId), eq(bupaConsultants.bupa_id, bupaId)))
                .run();

              errorCount++;
              continue;
            }

            if (
              parsedRegistration &&
              match.match_method !== "gmc_match" &&
              expectedRegistration === parsedRegistration
            ) {
              await db.update(consultantMatches)
                .set({
                  registration_number: parsed.registration_number,
                  match_confidence: "high",
                  match_method: "gmc_match",
                })
                .where(
                  and(
                    eq(consultantMatches.nuffield_slug, match.nuffield_slug),
                    eq(consultantMatches.bupa_id, bupaId)
                  )
                )
                .run();
            } else if (parsedRegistration) {
              await db.update(consultantMatches)
                .set({
                  registration_number: parsed.registration_number,
                })
                .where(
                  and(
                    eq(consultantMatches.nuffield_slug, match.nuffield_slug),
                    eq(consultantMatches.bupa_id, bupaId)
                  )
                )
                .run();
            }

            logger.info("BUPA", bupaId, "parsed", `name=${parsed.consultant_name}, specialties=${parsed.specialty_primary.length}`, progress);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error("BUPA", bupaId, "error", `parse: ${msg}`, progress);
            await upsertBupaConsultant(runId, bupaId, {
              scrape_status: "error",
              scrape_error: `parse: ${msg}`,
            });
            errorCount++;
            continue;
          }
        } else {
          parsed = parseBupaProfile(html!, bupaId, candidate.bupa_slug, candidate.profile_url);
        }

        // STAGE 3: ASSESS (reuse existing assessProfile)
        let assessment;
        if (skipAssess) {
          logger.info("BUPA", bupaId, "skipped", "--skip-assess flag", progress);
          await upsertBupaConsultant(runId, bupaId, { scrape_status: "assess_done" });
          assessment = {
            plain_english_score: 1,
            bio_depth: heuristicBioDepth(parsed.about_text),
            plain_english_reason: "skipped",
            bio_depth_reason: "skipped",
            treatment_specificity_score: "not_applicable" as const,
            treatment_specificity_reason: "skipped",
            qualifications_completeness: "missing" as const,
            qualifications_completeness_reason: "skipped",
            inferred_sub_specialties: [] as string[],
            personal_interests: null,
            professional_interests: null,
            clinical_interests: [] as string[],
            languages: [] as string[],
            declaration_substantive: false,
            overall_quality_notes: "skipped",
          };
        } else if (!shouldSkipStage(currentStatus, "assess_done")) {
          // Build profile text for AI
          const textParts: string[] = [];
          if (parsed.consultant_name) textParts.push(`Name: ${parsed.consultant_name}`);
          if (parsed.specialty_primary.length > 0) textParts.push(`Specialties: ${parsed.specialty_primary.join(", ")}`);
          if (parsed.about_text) textParts.push(`About:\n${parsed.about_text}`);
          if (parsed.treatments.length > 0) textParts.push(`Treatments: ${parsed.treatments.join(", ")}`);
          if (parsed.qualifications_credentials) textParts.push(`Qualifications: ${parsed.qualifications_credentials}`);

          const profileText = textParts.join("\n\n");

          try {
            assessment = await assessProfile(profileText, bupaId, progress);

            if (assessment.bio_depth === "missing" && parsed.about_text) {
              assessment.bio_depth = heuristicBioDepth(parsed.about_text);
              assessment.bio_depth_reason = `${assessment.bio_depth_reason} — overridden by heuristic`;
            }

            await upsertBupaConsultant(runId, bupaId, {
              plain_english_score: assessment.plain_english_score,
              plain_english_reason: assessment.plain_english_reason,
              bio_depth: assessment.bio_depth,
              bio_depth_reason: assessment.bio_depth_reason,
              treatment_specificity_score: assessment.treatment_specificity_score,
              treatment_specificity_reason: assessment.treatment_specificity_reason,
              qualifications_completeness: assessment.qualifications_completeness,
              qualifications_completeness_reason: assessment.qualifications_completeness_reason,
              ai_quality_notes: assessment.overall_quality_notes,
              scrape_status: "assess_done",
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error("BUPA", bupaId, "error", `assess: ${msg}`, progress);
            const fallbackBioDepth = heuristicBioDepth(parsed.about_text);
            await upsertBupaConsultant(runId, bupaId, {
              scrape_status: "assess_done",
              scrape_error: `assess: ${msg}`,
              bio_depth: fallbackBioDepth,
            });
            assessment = {
              plain_english_score: 1,
              bio_depth: fallbackBioDepth,
              plain_english_reason: "AI assessment failed",
              bio_depth_reason: "AI assessment failed — heuristic fallback",
              treatment_specificity_score: "not_applicable" as const,
              treatment_specificity_reason: "AI assessment failed",
              qualifications_completeness: "missing" as const,
              qualifications_completeness_reason: "AI assessment failed",
              inferred_sub_specialties: [] as string[],
              personal_interests: null,
              professional_interests: null,
              clinical_interests: [] as string[],
              languages: [] as string[],
              declaration_substantive: false,
              overall_quality_notes: "AI assessment failed",
            };
          }
        } else {
          // Read from DB for resume
          const row = await db.select({
            plain_english_score: bupaConsultants.plain_english_score,
            bio_depth: bupaConsultants.bio_depth,
          })
            .from(bupaConsultants)
            .where(and(eq(bupaConsultants.run_id, runId), eq(bupaConsultants.bupa_id, bupaId)))
            .get();

          assessment = {
            plain_english_score: row?.plain_english_score ?? 1,
            bio_depth: (row?.bio_depth as "substantive" | "adequate" | "thin" | "missing") ?? "missing",
            plain_english_reason: "resumed",
            bio_depth_reason: "resumed",
            treatment_specificity_score: "not_applicable" as const,
            treatment_specificity_reason: "resumed",
            qualifications_completeness: "missing" as const,
            qualifications_completeness_reason: "resumed",
            inferred_sub_specialties: [] as string[],
            personal_interests: null,
            professional_interests: null,
            clinical_interests: [] as string[],
            languages: [] as string[],
            declaration_substantive: false,
            overall_quality_notes: "resumed",
          };
        }

        // STAGE 4: SCORE (reuse existing scoreConsultant with no booking)
        try {
          const scoreInput = {
            has_photo: parsed.has_photo,
            bio_depth: assessment.bio_depth as "substantive" | "adequate" | "thin" | "missing" | null,
            treatments: parsed.treatments,
            qualifications_credentials: parsed.qualifications_credentials,
            specialty_primary: parsed.specialty_primary,
            specialty_sub: parsed.specialty_sub,
            insurers: [] as string[], // BUPA profiles don't list insurers
            consultation_times_raw: [] as string[], // Not available on BUPA
            plain_english_score: assessment.plain_english_score,
            booking_state: null as BookingState | null, // No booking on BUPA
            online_bookable: false,
            practising_since: null as number | null,
            memberships: parsed.memberships,
            available_slots_next_28_days: null as number | null,
            gmc_code_for_booking: null as string | null,
          };

          const scoreResult = scoreConsultant(scoreInput);

          // Compute adjusted score (no booking points for BUPA)
          const adjustedScore = computeAdjustedScore(scoreResult.profile_completeness_score, 0);

          await upsertBupaConsultant(runId, bupaId, {
            profile_completeness_score: scoreResult.profile_completeness_score,
            adjusted_score: adjustedScore,
            quality_tier: scoreResult.quality_tier,
            flags: scoreResult.flags,
            scrape_status: "complete",
            scrape_error: null,
          });

          logger.info("BUPA", bupaId, "complete", `${scoreResult.quality_tier}, raw=${scoreResult.profile_completeness_score}, adjusted=${adjustedScore}`, progress);
          successCount++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.error("BUPA", bupaId, "error", `score: ${msg}`, progress);
          await upsertBupaConsultant(runId, bupaId, {
            scrape_status: "error",
            scrape_error: `score: ${msg}`,
          });
          errorCount++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("BUPA", bupaId, "error", msg, progress);
        await upsertBupaConsultant(runId, bupaId, {
          scrape_status: "error",
          scrape_error: `pipeline: ${msg}`,
        });
        errorCount++;
      }
    }
  } finally {
    await browser.close();
    logger.info("BUPA", "browser", "closed");
  }

  // Update run record
  const runStatus = errorCount === total ? "failed" : "completed";
  await updateBupaRunStatus(runId, runStatus, successCount, errorCount, matchesToProcess.length);

  logger.info("BUPA", "summary", runStatus, `success=${successCount}, errors=${errorCount}, matches=${matchesToProcess.length}, total=${total}`);
  logger.info("BUPA", "summary", "done", `run_id=${runId}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

main().catch((error) => {
  logger.error("BUPA", "fatal", "error", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
