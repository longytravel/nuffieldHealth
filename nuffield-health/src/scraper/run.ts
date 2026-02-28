import { randomUUID } from "crypto";
import { db } from "@/db/index";
import { scrapeRuns, consultants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchSitemapUrls, launchBrowser, fetchProfile, applyScrapeDelay } from "./crawl";
import { parseProfile, heuristicBioDepth } from "./parse";
import { fetchBookingData, applyApiDelay } from "./booking";
import { assessProfile } from "./assess";
import { scoreConsultant } from "./score";
import { logger } from "@/lib/logger";
import type { ScrapeStatus, BookingState } from "@/lib/types";

const CONSULTANT_URL_PREFIX = "https://www.nuffieldhealth.com/consultants/";

// ── CLI argument parsing ──────────────────────────────────────────────────────

interface CliArgs {
  resume: boolean;
  slug: string | null;
  skipAssess: boolean;
  limit: number | null;
  random: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let resume = false;
  let slug: string | null = null;
  let skipAssess = false;
  let limit: number | null = null;
  let random = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--resume") {
      resume = true;
    } else if (args[i] === "--slug" && i + 1 < args.length) {
      slug = args[i + 1];
      i++;
    } else if (args[i] === "--skip-assess") {
      skipAssess = true;
    } else if (args[i] === "--limit" && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--random") {
      random = true;
    }
  }

  return { resume, slug, skipAssess, limit, random };
}

// ── Database helpers ──────────────────────────────────────────────────────────

function createRun(runId: string, totalProfiles: number): void {
  db.insert(scrapeRuns).values({
    run_id: runId,
    started_at: new Date().toISOString(),
    status: "running",
    total_profiles: totalProfiles,
    success_count: 0,
    error_count: 0,
  }).run();
}

function updateRunStatus(runId: string, status: "completed" | "failed", successCount: number, errorCount: number): void {
  db.update(scrapeRuns)
    .set({
      completed_at: new Date().toISOString(),
      status,
      success_count: successCount,
      error_count: errorCount,
    })
    .where(eq(scrapeRuns.run_id, runId))
    .run();
}

function findLatestIncompleteRun(): string | null {
  const row = db.select()
    .from(scrapeRuns)
    .where(eq(scrapeRuns.status, "running"))
    .orderBy(scrapeRuns.started_at)
    .limit(1)
    .get();

  return row?.run_id ?? null;
}

function upsertConsultant(runId: string, slug: string, data: Record<string, unknown>): void {
  // Check if record exists
  const existing = db.select()
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
    .get();

  if (existing) {
    db.update(consultants)
      .set(data)
      .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
      .run();
  } else {
    db.insert(consultants)
      .values({
        run_id: runId,
        slug,
        profile_slug: slug,
        profile_status: "active",
        scrape_status: "pending",
        ...data,
      })
      .run();
  }
}

function getConsultantStatus(runId: string, slug: string): ScrapeStatus | null {
  const row = db.select({ scrape_status: consultants.scrape_status })
    .from(consultants)
    .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
    .get();

  return (row?.scrape_status as ScrapeStatus) ?? null;
}

// ── Pipeline stages ──────────────────────────────────────────────────────────

async function runCrawlStage(
  browser: Awaited<ReturnType<typeof launchBrowser>>,
  runId: string,
  slug: string,
  url: string,
  progress: { current: number; total: number }
): Promise<{ html: string; httpStatus: number } | null> {
  try {
    const result = await fetchProfile(browser, url, slug, runId, progress);
    const profileStatus = result.httpStatus === 404 ? "deleted" : "active";
    upsertConsultant(runId, slug, {
      profile_url: url,
      http_status: result.httpStatus,
      profile_status: profileStatus,
      scrape_status: "crawl_done",
    });
    return { html: result.html, httpStatus: result.httpStatus };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("CRAWL", slug, "error", msg, progress);
    upsertConsultant(runId, slug, {
      profile_url: url,
      profile_status: "error",
      scrape_status: "error",
      scrape_error: `crawl: ${msg}`,
    });
    return null;
  }
}

function runParseStage(
  runId: string,
  slug: string,
  html: string,
  httpStatus: number,
  progress: { current: number; total: number }
): ReturnType<typeof parseProfile> | null {
  try {
    const parsed = parseProfile(html, slug);

    // Build the profile text for AI assessment (about + overview + related experience)
    const profileTextParts: string[] = [];
    if (parsed.about_text) profileTextParts.push(parsed.about_text);
    if (parsed.overview_text) profileTextParts.push(parsed.overview_text);
    if (parsed.related_experience_text) profileTextParts.push(parsed.related_experience_text);

    upsertConsultant(runId, slug, {
      consultant_name: parsed.consultant_name,
      consultant_title_prefix: parsed.consultant_title_prefix,
      registration_number: parsed.registration_number,
      gmc_code_for_booking: parsed.gmc_code_for_booking,
      has_photo: parsed.has_photo,
      specialty_primary: parsed.specialty_primary,
      specialty_sub: parsed.specialty_sub,
      treatments: parsed.treatments,
      treatments_excluded: parsed.treatments_excluded,
      insurers: parsed.insurers,
      insurer_count: parsed.insurer_count,
      qualifications_credentials: parsed.qualifications_credentials,
      practising_since: parsed.practising_since,
      memberships: parsed.memberships,
      clinical_interests: parsed.clinical_interests,
      personal_interests: parsed.personal_interests,
      languages: parsed.languages,
      consultation_times_raw: parsed.consultation_times_raw,
      declaration: parsed.declaration,
      declaration_substantive: parsed.declaration_substantive,
      in_the_news: parsed.in_the_news,
      professional_roles: parsed.professional_roles,
      patient_age_restriction: parsed.patient_age_restriction,
      patient_age_restriction_min: parsed.patient_age_restriction_min,
      patient_age_restriction_max: parsed.patient_age_restriction_max,
      external_website: parsed.external_website,
      cqc_rating: parsed.cqc_rating,
      booking_caveat: parsed.booking_caveat,
      contact_phone: parsed.contact_phone,
      contact_mobile: parsed.contact_mobile,
      contact_email: parsed.contact_email,
      hospital_name_primary: parsed.hospital_name_primary,
      hospital_code_primary: parsed.hospital_code_primary,
      hospital_is_nuffield: parsed.hospital_is_nuffield,
      hospital_nuffield_at_nhs: parsed.hospital_nuffield_at_nhs,
      online_bookable: parsed.booking_state !== "not_bookable",
      scrape_status: "parse_done",
    });

    logger.info("PARSE", slug, "success", `${parsed.specialty_primary.length} specialties, photo=${parsed.has_photo}`, progress);

    return parsed;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("PARSE", slug, "error", msg, progress);
    upsertConsultant(runId, slug, {
      scrape_status: "error",
      scrape_error: `parse: ${msg}`,
    });
    return null;
  }
}

async function runBookingStage(
  runId: string,
  slug: string,
  gmcCodeForBooking: string | null,
  onlineBookable: boolean,
  progress: { current: number; total: number }
): Promise<{ booking_state: BookingState; available_days_next_28_days: number; available_slots_next_28_days: number; avg_slots_per_day: number | null; next_available_date: string | null; days_to_first_available: number | null; consultation_price: number | null }> {
  // Default: not bookable
  const defaultResult = {
    booking_state: "not_bookable" as BookingState,
    available_days_next_28_days: 0,
    available_slots_next_28_days: 0,
    avg_slots_per_day: null as number | null,
    next_available_date: null as string | null,
    days_to_first_available: null as number | null,
    consultation_price: null as number | null,
  };

  if (!gmcCodeForBooking || !onlineBookable) {
    logger.info("BOOKING", slug, "skipped", gmcCodeForBooking ? "not bookable online" : "non-numeric registration", progress);
    upsertConsultant(runId, slug, {
      booking_state: defaultResult.booking_state,
      available_days_next_28_days: 0,
      available_slots_next_28_days: 0,
      avg_slots_per_day: null,
      next_available_date: null,
      days_to_first_available: null,
      consultation_price: null,
      scrape_status: "booking_done",
    });
    return defaultResult;
  }

  try {
    const bookingResult = await fetchBookingData(gmcCodeForBooking, slug, progress);
    upsertConsultant(runId, slug, {
      booking_state: bookingResult.booking_state,
      available_days_next_28_days: bookingResult.available_days_next_28_days,
      available_slots_next_28_days: bookingResult.available_slots_next_28_days,
      avg_slots_per_day: bookingResult.avg_slots_per_day,
      next_available_date: bookingResult.next_available_date,
      days_to_first_available: bookingResult.days_to_first_available,
      consultation_price: bookingResult.consultation_price,
      scrape_status: "booking_done",
    });
    return bookingResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("BOOKING", slug, "error", msg, progress);
    // BUG-011: Preserve page-detected bookability on API failure
    const fallbackState = onlineBookable ? "bookable_no_slots" : "not_bookable";
    upsertConsultant(runId, slug, {
      booking_state: fallbackState,
      available_days_next_28_days: 0,
      available_slots_next_28_days: 0,
      avg_slots_per_day: null,
      days_to_first_available: null,
      scrape_status: "booking_done",
      scrape_error: `booking: ${msg}`,
    });
    return { ...defaultResult, booking_state: fallbackState as BookingState };
  }
}

async function runAssessStage(
  runId: string,
  slug: string,
  parsed: ReturnType<typeof parseProfile>,
  progress: { current: number; total: number }
): Promise<ReturnType<typeof assessProfile> extends Promise<infer T> ? T : never> {
  // Build profile text for AI assessment
  const textParts: string[] = [];
  if (parsed.consultant_name) textParts.push(`Name: ${parsed.consultant_name}`);
  if (parsed.specialty_primary.length > 0) textParts.push(`Specialties: ${parsed.specialty_primary.join(", ")}`);
  if (parsed.about_text) textParts.push(`About:\n${parsed.about_text}`);
  if (parsed.overview_text) textParts.push(`Overview:\n${parsed.overview_text}`);
  if (parsed.related_experience_text) textParts.push(`Related Experience:\n${parsed.related_experience_text}`);
  if (parsed.treatments.length > 0) textParts.push(`Treatments: ${parsed.treatments.join(", ")}`);
  if (parsed.qualifications_credentials) textParts.push(`Qualifications: ${parsed.qualifications_credentials}`);
  if (parsed.declaration) textParts.push(`Declaration: ${parsed.declaration.join(" ")}`);
  if (parsed.clinical_interests.length > 0) textParts.push(`Clinical Interests: ${parsed.clinical_interests.join(", ")}`);

  const profileText = textParts.join("\n\n");

  try {
    const assessment = await assessProfile(profileText, slug, progress);
    // If AI returned "missing" but we have about text, use heuristic fallback
    if (assessment.bio_depth === "missing" && parsed.about_text) {
      assessment.bio_depth = heuristicBioDepth(parsed.about_text);
      assessment.bio_depth_reason = `${assessment.bio_depth_reason} — overridden by heuristic`;
    }
    upsertConsultant(runId, slug, {
      plain_english_score: assessment.plain_english_score,
      plain_english_reason: assessment.plain_english_reason,
      bio_depth: assessment.bio_depth,
      bio_depth_reason: assessment.bio_depth_reason,
      treatment_specificity_score: assessment.treatment_specificity_score,
      treatment_specificity_reason: assessment.treatment_specificity_reason,
      qualifications_completeness: assessment.qualifications_completeness,
      qualifications_completeness_reason: assessment.qualifications_completeness_reason,
      declaration_substantive: assessment.declaration_substantive,
      ai_quality_notes: assessment.overall_quality_notes,
      scrape_status: "assess_done",
    });

    // Merge AI-inferred fields if they add value
    if (assessment.clinical_interests.length > 0) {
      upsertConsultant(runId, slug, {
        clinical_interests: [
          ...parsed.clinical_interests,
          ...assessment.clinical_interests.filter(
            (ci) => !parsed.clinical_interests.some((p) => p.toLowerCase() === ci.toLowerCase())
          ),
        ],
      });
    }
    if (assessment.languages.length > 0) {
      upsertConsultant(runId, slug, {
        languages: [
          ...parsed.languages,
          ...assessment.languages.filter(
            (l) => !parsed.languages.some((p) => p.toLowerCase() === l.toLowerCase())
          ),
        ],
      });
    }
    if (assessment.personal_interests && !parsed.personal_interests) {
      upsertConsultant(runId, slug, {
        personal_interests: assessment.personal_interests,
      });
    }
    if (assessment.professional_interests) {
      upsertConsultant(runId, slug, {
        professional_interests: assessment.professional_interests,
      });
    }
    if (assessment.inferred_sub_specialties.length > 0) {
      upsertConsultant(runId, slug, {
        specialty_sub: [
          ...parsed.specialty_sub,
          ...assessment.inferred_sub_specialties.filter(
            (s) => !parsed.specialty_sub.some((p) => p.toLowerCase() === s.toLowerCase())
          ),
        ],
      });
    }

    return assessment;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("AI", slug, "error", msg, progress);
    const fallbackBioDepth = heuristicBioDepth(parsed.about_text);
    upsertConsultant(runId, slug, {
      scrape_status: "assess_done",
      scrape_error: `ai_assessment: ${msg}`,
      bio_depth: fallbackBioDepth,
    });
    // Return default assessment — pipeline continues (use heuristic bio depth)
    return {
      plain_english_score: 1,
      plain_english_reason: "AI assessment failed",
      bio_depth: heuristicBioDepth(parsed.about_text),
      bio_depth_reason: "AI assessment failed — heuristic fallback",
      treatment_specificity_score: "not_applicable" as const,
      treatment_specificity_reason: "AI assessment failed",
      qualifications_completeness: "missing" as const,
      qualifications_completeness_reason: "AI assessment failed",
      inferred_sub_specialties: [],
      personal_interests: null,
      professional_interests: null,
      clinical_interests: [],
      languages: [],
      declaration_substantive: false,
      overall_quality_notes: "AI assessment failed",
    };
  }
}

function runScoreStage(
  runId: string,
  slug: string,
  parsed: ReturnType<typeof parseProfile>,
  bookingResult: { booking_state: BookingState; available_slots_next_28_days: number },
  assessment: { plain_english_score: number; bio_depth: string; inferred_sub_specialties?: string[] },
  progress: { current: number; total: number }
): void {
  try {
    const mergedSpecialtySub = [
      ...parsed.specialty_sub,
      ...(assessment.inferred_sub_specialties ?? []).filter(
        (s) => !parsed.specialty_sub.some((p) => p.toLowerCase() === s.toLowerCase())
      ),
    ];

    const scoreInput = {
      has_photo: parsed.has_photo,
      bio_depth: assessment.bio_depth as "substantive" | "adequate" | "thin" | "missing" | null,
      treatments: parsed.treatments,
      qualifications_credentials: parsed.qualifications_credentials,
      specialty_primary: parsed.specialty_primary,
      specialty_sub: mergedSpecialtySub,
      insurers: parsed.insurers,
      consultation_times_raw: parsed.consultation_times_raw,
      plain_english_score: assessment.plain_english_score,
      booking_state: bookingResult.booking_state,
      online_bookable: parsed.booking_state !== "not_bookable",
      practising_since: parsed.practising_since,
      memberships: parsed.memberships,
      available_slots_next_28_days: bookingResult.available_slots_next_28_days,
      gmc_code_for_booking: parsed.gmc_code_for_booking,
    };

    const scoreResult = scoreConsultant(scoreInput);

    // Add CMS corruption flag if detected
    if (parsed.cms_corruption_detected) {
      scoreResult.flags.push({
        code: "CONTENT_CMS_CORRUPTION",
        severity: "warn",
        message: "CMS text corruption detected (formatting artifacts)",
      });
    }

    // Add substantive declaration flag
    if (parsed.declaration_substantive) {
      scoreResult.flags.push({
        code: "PROFILE_SUBSTANTIVE_DECLARATION",
        severity: "info",
        message: "Declaration contains substantive financial interests",
      });
    }

    // Add non-Nuffield hospital flag
    if (!parsed.hospital_is_nuffield) {
      scoreResult.flags.push({
        code: "PROFILE_NON_NUFFIELD_HOSPITAL",
        severity: "info",
        message: "Primary hospital is not a Nuffield facility",
      });
    }

    // Add age restriction flag
    if (parsed.patient_age_restriction) {
      scoreResult.flags.push({
        code: "PROFILE_AGE_RESTRICTION",
        severity: "info",
        message: `Patient age restriction: ${parsed.patient_age_restriction}`,
      });
    }

    // Check for low confidence on any field
    const lowConfidenceFields = Object.entries(parsed.confidence).filter(
      ([, conf]) => conf === "low"
    );
    if (lowConfidenceFields.length > 0) {
      scoreResult.flags.push({
        code: "QA_LOW_CONFIDENCE",
        severity: "warn",
        message: `Low confidence on: ${lowConfidenceFields.map(([f]) => f).join(", ")}`,
      });
    }

    upsertConsultant(runId, slug, {
      profile_completeness_score: scoreResult.profile_completeness_score,
      quality_tier: scoreResult.quality_tier,
      flags: scoreResult.flags,
      scrape_status: "complete",
      scrape_error: null,
    });

    logger.info("SCORE", slug, "success", `${scoreResult.quality_tier}, score=${scoreResult.profile_completeness_score}`, progress);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("SCORE", slug, "error", msg, progress);
    upsertConsultant(runId, slug, {
      scrape_status: "error",
      scrape_error: `score: ${msg}`,
    });
  }
}

// ── Determine which stage to resume from ─────────────────────────────────────

function shouldSkipStage(currentStatus: ScrapeStatus | null, targetStage: ScrapeStatus): boolean {
  const progression: ScrapeStatus[] = [
    "pending", "crawl_done", "parse_done", "booking_done", "assess_done", "complete",
  ];
  if (!currentStatus || currentStatus === "error") return false;
  if (currentStatus === "complete") return true;

  const currentIdx = progression.indexOf(currentStatus);
  const targetIdx = progression.indexOf(targetStage);
  return currentIdx >= targetIdx;
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { resume, slug: singleSlug, skipAssess, limit, random } = parseCliArgs();

  const modeDesc = resume ? "resume mode" : singleSlug ? `single: ${singleSlug}` : "full run";
  const flags = [skipAssess && "skip-assess", limit && `limit=${limit}`, random && "random"].filter(Boolean).join(", ");
  logger.info("PIPELINE", "init", "starting", flags ? `${modeDesc} (${flags})` : modeDesc);

  let runId: string;

  if (resume) {
    const existingRunId = findLatestIncompleteRun();
    if (!existingRunId) {
      logger.error("PIPELINE", "init", "error", "No incomplete run found to resume");
      process.exit(1);
    }
    runId = existingRunId;
    logger.info("PIPELINE", "init", "resuming", `run_id=${runId}`);
  } else {
    runId = randomUUID();
  }

  // Discover profiles
  let profiles: { url: string; slug: string }[];
  if (singleSlug) {
    profiles = [{
      url: `${CONSULTANT_URL_PREFIX}${singleSlug}`,
      slug: singleSlug,
    }];
  } else {
    profiles = await fetchSitemapUrls();
  }

  if (random) {
    for (let i = profiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    }
    logger.info("PIPELINE", "init", "shuffled", `${profiles.length} profiles randomised`);
  }

  if (limit && limit > 0 && profiles.length > limit) {
    const fullCount = profiles.length;
    profiles = profiles.slice(0, limit);
    logger.info("PIPELINE", "init", "limited", `capped to ${limit} of ${fullCount} profiles`);
  }

  const total = profiles.length;

  if (!resume) {
    createRun(runId, total);
  } else {
    // Update total in case sitemap changed
    db.update(scrapeRuns)
      .set({ total_profiles: total })
      .where(eq(scrapeRuns.run_id, runId))
      .run();
  }

  logger.info("PIPELINE", "init", "ready", `${total} profiles, run_id=${runId}`);

  // Launch browser once for full run
  const browser = await launchBrowser();

  let successCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < profiles.length; i++) {
      const { url, slug } = profiles[i];
      const progress = { current: i + 1, total };

      // Check current status for resume logic
      const currentStatus = getConsultantStatus(runId, slug);
      if (currentStatus === "complete") {
        successCount++;
        continue;
      }

      try {
        // STAGE 1: CRAWL
        let html: string | null = null;
        let httpStatus = 0;

        if (!shouldSkipStage(currentStatus, "crawl_done")) {
          const crawlResult = await runCrawlStage(browser, runId, slug, url, progress);
          if (!crawlResult) {
            errorCount++;
            await applyScrapeDelay();
            continue;
          }
          html = crawlResult.html;
          httpStatus = crawlResult.httpStatus;
          await applyScrapeDelay();
        } else {
          // Need to read HTML from cache for subsequent stages
          const { readFileSync } = await import("fs");
          const { join } = await import("path");
          const { HTML_CACHE_PATH } = await import("@/lib/config");
          try {
            html = readFileSync(join(HTML_CACHE_PATH, runId, `${slug}.html`), "utf-8");
            const row = db.select({ http_status: consultants.http_status })
              .from(consultants)
              .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
              .get();
            httpStatus = row?.http_status ?? 200;
          } catch {
            logger.error("CRAWL", slug, "error", "Cannot read cached HTML for resume", progress);
            errorCount++;
            continue;
          }
        }

        // Skip parse/booking/assess/score for deleted profiles
        if (httpStatus === 404) {
          upsertConsultant(runId, slug, {
            profile_status: "deleted",
            scrape_status: "complete",
          });
          successCount++;
          continue;
        }

        // STAGE 2: PARSE
        let parsed: ReturnType<typeof parseProfile> | null = null;

        if (!shouldSkipStage(currentStatus, "parse_done")) {
          parsed = runParseStage(runId, slug, html!, httpStatus, progress);
          if (!parsed) {
            errorCount++;
            continue;
          }
        } else {
          // Re-parse for data needed by subsequent stages
          parsed = parseProfile(html!, slug);
        }

        // STAGE 3: BOOKING
        let bookingResult = {
          booking_state: "not_bookable" as BookingState,
          available_days_next_28_days: 0,
          available_slots_next_28_days: 0,
          avg_slots_per_day: null as number | null,
          next_available_date: null as string | null,
          days_to_first_available: null as number | null,
          consultation_price: null as number | null,
        };

        if (!shouldSkipStage(currentStatus, "booking_done")) {
          const onlineBookable = parsed.booking_state !== "not_bookable";
          bookingResult = await runBookingStage(runId, slug, parsed.gmc_code_for_booking, onlineBookable, progress);
          await applyApiDelay();
        } else {
          // Read from DB
          const row = db.select({
            booking_state: consultants.booking_state,
            available_days_next_28_days: consultants.available_days_next_28_days,
            available_slots_next_28_days: consultants.available_slots_next_28_days,
            avg_slots_per_day: consultants.avg_slots_per_day,
            next_available_date: consultants.next_available_date,
            days_to_first_available: consultants.days_to_first_available,
            consultation_price: consultants.consultation_price,
          })
            .from(consultants)
            .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
            .get();

          if (row) {
            bookingResult = {
              booking_state: (row.booking_state as BookingState) ?? "not_bookable",
              available_days_next_28_days: row.available_days_next_28_days ?? 0,
              available_slots_next_28_days: row.available_slots_next_28_days ?? 0,
              avg_slots_per_day: row.avg_slots_per_day ?? null,
              next_available_date: row.next_available_date ?? null,
              days_to_first_available: row.days_to_first_available ?? null,
              consultation_price: row.consultation_price ?? null,
            };
          }
        }

        // STAGE 4: ASSESS
        let assessment: {
          plain_english_score: number;
          bio_depth: "substantive" | "adequate" | "thin" | "missing";
          plain_english_reason: string;
          bio_depth_reason: string;
          treatment_specificity_score: "highly_specific" | "moderately_specific" | "generic" | "not_applicable";
          treatment_specificity_reason: string;
          inferred_sub_specialties: string[];
          personal_interests: string | null;
          clinical_interests: string[];
          languages: string[];
          declaration_substantive: boolean;
          overall_quality_notes: string;
        } = {
          plain_english_score: 1,
          bio_depth: heuristicBioDepth(parsed.about_text),
          plain_english_reason: "skipped",
          bio_depth_reason: "skipped — heuristic fallback",
          treatment_specificity_score: "not_applicable",
          treatment_specificity_reason: "skipped",
          inferred_sub_specialties: [],
          personal_interests: null,
          clinical_interests: [],
          languages: [],
          declaration_substantive: false,
          overall_quality_notes: "skipped",
        };

        if (skipAssess) {
          logger.info("AI", slug, "skipped", "--skip-assess flag", progress);
          upsertConsultant(runId, slug, { scrape_status: "assess_done" });
        } else if (!shouldSkipStage(currentStatus, "assess_done")) {
          assessment = await runAssessStage(runId, slug, parsed, progress);
        } else {
          // Read from DB
          const row = db.select({
            plain_english_score: consultants.plain_english_score,
            bio_depth: consultants.bio_depth,
          })
            .from(consultants)
            .where(and(eq(consultants.run_id, runId), eq(consultants.slug, slug)))
            .get();

          if (row) {
            assessment = {
              ...assessment,
              plain_english_score: row.plain_english_score ?? 1,
              bio_depth: (row.bio_depth as "substantive" | "adequate" | "thin" | "missing") ?? "missing",
            };
          }
        }

        // STAGE 5: SCORE
        runScoreStage(runId, slug, parsed, bookingResult, assessment, progress);

        // Check final status
        const finalStatus = getConsultantStatus(runId, slug);
        if (finalStatus === "complete") {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("PIPELINE", slug, "error", msg, progress);
        upsertConsultant(runId, slug, {
          profile_status: "error",
          scrape_status: "error",
          scrape_error: `pipeline: ${msg}`,
        });
        errorCount++;
      }
    }
  } finally {
    await browser.close();
    logger.info("PIPELINE", "browser", "closed");
  }

  // Update run record
  const runStatus = errorCount === total ? "failed" : "completed";
  updateRunStatus(runId, runStatus, successCount, errorCount);

  // Log summary
  logger.info("PIPELINE", "summary", runStatus, `success=${successCount}, errors=${errorCount}, total=${total}`);
  logger.info("PIPELINE", "summary", "done", `run_id=${runId}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

main().catch((error) => {
  logger.error("PIPELINE", "fatal", "error", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
