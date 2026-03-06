import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { ANTHROPIC_API_KEY } from "@/lib/config";
import { searchWeb } from "@/lib/tavily-search";
import { corroborateFacts } from "@/lib/corroboration";
import { downloadConsultantPhoto } from "@/lib/photo-downloader";
import { generateRewrite, calculateSeoScore } from "@/lib/rewrite-engine";
import { scoreConsultant } from "@/scraper/score";
import {
  insertRewrite,
  updateRewriteContent,
  insertResearchSource,
  markSourceCorroborated,
  getConsultant,
  getBenchmarkProfiles,
} from "@/db/queries";
import type { RewritableElementKey, ResearchStage, RewriteProgress } from "@/lib/types";
import type { FactWithSources, ResearchSource } from "@/lib/corroboration";
import type { ScoreInput } from "@/scraper/score";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const EXTRACTION_TEMPERATURE = 0.3;
const FETCH_TIMEOUT_MS = 10_000;
const TOP_RESULTS_PER_QUERY = 5;
const SNIPPET_MAX_CHARS = 3000;

// ============================================================
// Types
// ============================================================

export interface PipelineParams {
  slug: string;
  run_id: string;
  rewrite_id: string;
  elements?: RewritableElementKey[];
  mode: "full" | "element";
}

export interface PipelineResult {
  rewrite_id: string;
  slug: string;
  elements_completed: RewritableElementKey[];
  elements_failed: RewritableElementKey[];
  projected_total_score: number | null;
  projected_tier: "Gold" | "Silver" | "Bronze" | "Incomplete" | null;
  error: string | null;
  search_errors: string[];
}

export interface BatchProgress {
  current: number;
  total: number;
  slug: string;
  status: "pending" | "in_progress" | "complete" | "failed";
  result?: PipelineResult;
}

export type ProgressCallback = (progress: RewriteProgress) => void;

// ============================================================
// In-memory search error store (for polling endpoint visibility)
// ============================================================

const searchErrorStore = new Map<string, string[]>();

/** Get search errors for a rewrite (used by polling endpoint) */
export function getSearchErrors(rewriteId: string): string[] {
  return searchErrorStore.get(rewriteId) ?? [];
}

// ============================================================
// Anthropic client
// ============================================================

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// ============================================================
// Zod schema for fact extraction output
// ============================================================

const extractedFactSchema = z.object({
  element: z.string(),
  fact: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const extractionResponseSchema = z.array(extractedFactSchema);

// ============================================================
// Stage 1: Build search queries
// ============================================================

interface SearchQueries {
  primary: string;
  secondary: string;
  photo: string;
}

function buildSearchQueries(
  consultantName: string,
  specialtyPrimary: string,
  hospitalNamePrimary: string | null
): SearchQueries {
  return {
    primary: `"${consultantName}" ${specialtyPrimary} consultant`,
    secondary: hospitalNamePrimary
      ? `"${consultantName}" ${hospitalNamePrimary}`
      : `"${consultantName}" ${specialtyPrimary} hospital`,
    photo: `"${consultantName}" ${specialtyPrimary} portrait photo`,
  };
}

// ============================================================
// Stage 2: Fetch page content
// ============================================================

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ConsultantIntelligence/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();

    // Strip HTML tags — simple approach sufficient for snippet extraction
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim();

    return text.slice(0, SNIPPET_MAX_CHARS);
  } catch {
    return null;
  }
}

// ============================================================
// Stage 3: Extract facts via Haiku
// ============================================================

async function extractFactsFromSnippet(
  snippet: string,
  sourceUrl: string,
  consultantName: string,
  specialtyPrimary: string,
  hospitalNamePrimary: string | null,
  registrationNumber: string | null
): Promise<z.infer<typeof extractedFactSchema>[]> {
  const anthropic = getClient();

  const prompt = `You are a medical research assistant extracting factual information about a healthcare consultant.

CONSULTANT: ${consultantName}
KNOWN SPECIALTY: ${specialtyPrimary}
KNOWN HOSPITAL: ${hospitalNamePrimary ?? "unknown"}
REGISTRATION NUMBER: ${registrationNumber ?? "unknown"}

SOURCE URL: ${sourceUrl}
SOURCE CONTENT:
${snippet}

Extract ALL factual information about this consultant from the source. Return a JSON array of facts:

[
  { "element": "bio", "fact": "...", "confidence": "high|medium|low" },
  { "element": "qualifications", "fact": "...", "confidence": "high|medium|low" },
  { "element": "memberships", "fact": "...", "confidence": "high|medium|low" },
  { "element": "treatments", "fact": "...", "confidence": "high|medium|low" },
  { "element": "clinical_interests", "fact": "...", "confidence": "high|medium|low" },
  { "element": "sub_specialties", "fact": "...", "confidence": "high|medium|low" },
  { "element": "practising_since", "fact": "...", "confidence": "high|medium|low" },
  { "element": "personal_interests", "fact": "...", "confidence": "high|medium|low" }
]

Rules:
- Only extract facts explicitly stated in the source — do NOT infer or assume
- Confidence: "high" = directly stated with context, "medium" = mentioned but ambiguous, "low" = implied or tangential
- If the source contains no relevant information, return an empty array []
- Verify the content is about the SAME person (check name, specialty, hospital match)
- If you cannot confirm this is the same consultant, return an empty array []`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1000,
        temperature: EXTRACTION_TEMPERATURE,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") continue;

      const raw = textBlock.text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(raw);
      return extractionResponseSchema.parse(parsed);
    } catch {
      if (attempt === 0) continue;
      return [];
    }
  }
  return [];
}

// ============================================================
// Stage 5: Get exemplar content for generation
// ============================================================

async function getExemplarContent(
  runId: string,
  specialtyPrimary: string,
  element: RewritableElementKey
): Promise<string | null> {
  // Try same specialty first, fall back to any Gold profile per spec §9.3
  let benchmarks = await getBenchmarkProfiles(runId, 1, specialtyPrimary);
  if (benchmarks.length === 0) {
    benchmarks = await getBenchmarkProfiles(runId, 1);
  }
  if (benchmarks.length === 0) return null;

  const exemplar = benchmarks[0];

  // Fetch the actual consultant record to extract element content
  const record = await getConsultant(runId, exemplar.slug);
  if (!record) return null;

  switch (element) {
    case "bio":
      return record.about_text ?? null;
    case "treatments":
      return record.treatments?.length ? JSON.stringify(record.treatments) : null;
    case "qualifications":
      return record.qualifications_credentials ?? null;
    case "specialty_sub":
      return record.specialty_sub?.length ? JSON.stringify(record.specialty_sub) : null;
    case "memberships":
      return record.memberships?.length ? JSON.stringify(record.memberships) : null;
    case "practising_since":
      return record.practising_since !== null ? String(record.practising_since) : null;
    case "clinical_interests":
      return record.clinical_interests?.length ? JSON.stringify(record.clinical_interests) : null;
    case "personal_interests":
      return record.personal_interests ?? null;
    default:
      return null;
  }
}

// ============================================================
// Helper: get original content for an element
// ============================================================

function getOriginalContent(
  record: Awaited<ReturnType<typeof getConsultant>>,
  element: RewritableElementKey
): string | null {
  if (!record) return null;
  switch (element) {
    case "bio": return record.about_text ?? null;
    case "treatments": return record.treatments?.length ? JSON.stringify(record.treatments) : null;
    case "qualifications": return record.qualifications_credentials ?? null;
    case "specialty_sub": return record.specialty_sub?.length ? JSON.stringify(record.specialty_sub) : null;
    case "memberships": return record.memberships?.length ? JSON.stringify(record.memberships) : null;
    case "practising_since": return record.practising_since !== null ? String(record.practising_since) : null;
    case "clinical_interests": return record.clinical_interests?.length ? JSON.stringify(record.clinical_interests) : null;
    case "personal_interests": return record.personal_interests ?? null;
    case "photo": return null;
  }
}

// ============================================================
// Helper: apply rewritten content to a ScoreInput
// ============================================================

function applyRewriteToScoreInput(
  base: ScoreInput,
  element: RewritableElementKey,
  content: string | null
): ScoreInput {
  if (content === null) return base;

  const updated = { ...base };

  switch (element) {
    case "bio":
      // bio_depth and plain_english are AI-assessed fields; for projection
      // assume the rewrite achieves "substantive" quality with score 5
      // (the generation prompt enforces plain English, jargon-free language)
      updated.bio_depth = "substantive";
      updated.plain_english_score = 5;
      break;
    case "treatments":
      try { updated.treatments = JSON.parse(content); } catch { /* keep existing */ }
      break;
    case "qualifications":
      updated.qualifications_credentials = content;
      break;
    case "specialty_sub":
      try { updated.specialty_sub = JSON.parse(content); } catch { /* keep existing */ }
      break;
    case "memberships":
      try { updated.memberships = JSON.parse(content); } catch { /* keep existing */ }
      break;
    case "practising_since":
      updated.practising_since = parseInt(content, 10) || base.practising_since;
      break;
    case "clinical_interests":
    case "personal_interests":
    case "photo":
      // These don't directly map to ScoreInput fields that affect the score
      break;
  }

  return updated;
}

// ============================================================
// Main pipeline
// ============================================================

/**
 * Run the full research pipeline for a single consultant.
 * Stages: Search → Fetch → Extract → Corroborate → Generate → Score → Store
 * Per spec §4.1.
 */
export async function runResearchPipeline(
  params: PipelineParams,
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  const { slug, run_id, rewrite_id, mode } = params;
  const elements: RewritableElementKey[] = params.elements ?? [
    "bio", "treatments", "qualifications", "specialty_sub",
    "memberships", "practising_since", "clinical_interests",
    "personal_interests", "photo",
  ];

  const searchErrors: string[] = [];

  const progress: RewriteProgress = {
    current_stage: "searching",
    sources_found: 0,
    facts_extracted: 0,
    search_errors: searchErrors,
  };

  const emitProgress = (stage: ResearchStage) => {
    progress.current_stage = stage;
    onProgress?.(progress);
  };

  // ---- Load consultant record ----
  const record = await getConsultant(run_id, slug);
  if (!record) {
    return {
      rewrite_id,
      slug,
      elements_completed: [],
      elements_failed: elements,
      projected_total_score: null,
      projected_tier: null,
      error: `Consultant not found: ${slug} in run ${run_id}`,
      search_errors: [],
    };
  }

  const consultantName = record.consultant_name ?? slug;
  const specialtyPrimary = (record.specialty_primary ?? [])[0] ?? "General Medicine";
  const hospitalNamePrimary = record.hospital_name_primary ?? null;
  const registrationNumber = record.registration_number ?? null;

  // ---- Stage 1: Search ----
  emitProgress("searching");
  const queries = buildSearchQueries(consultantName, specialtyPrimary, hospitalNamePrimary);
  const searchQueries = [queries.primary, queries.secondary];

  const allSearchResults: { url: string; title: string; description: string; query: string }[] = [];

  for (const query of searchQueries) {
    try {
      const results = await searchWeb(query);
      const top = results.slice(0, TOP_RESULTS_PER_QUERY);
      for (const r of top) {
        allSearchResults.push({ ...r, query });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[research-pipeline] Search failed for "${query}": ${msg}`);
      searchErrors.push(msg);
    }
  }

  // Store search errors so the polling endpoint can surface them
  searchErrorStore.set(rewrite_id, searchErrors);

  progress.sources_found = allSearchResults.length;
  emitProgress("fetching");

  // ---- Stage 2: Fetch + Stage 3: Extract ----
  emitProgress("extracting");

  const storedSources: ResearchSource[] = [];

  for (const result of allSearchResults) {
    const snippet = await fetchPageText(result.url);
    if (!snippet) continue;

    const facts = await extractFactsFromSnippet(
      snippet,
      result.url,
      consultantName,
      specialtyPrimary,
      hospitalNamePrimary,
      registrationNumber
    );

    progress.facts_extracted += facts.length;

    const sourceId = randomUUID();
    const now = new Date().toISOString();

    insertResearchSource({
      source_id: sourceId,
      rewrite_id,
      slug,
      search_query: result.query,
      result_url: result.url,
      result_title: result.title,
      page_content_snippet: snippet,
      extracted_facts: facts.length > 0 ? facts : null,
      corroborated: 0,
      reliability_notes: null,
      fetched_at: now,
    });

    storedSources.push({
      source_id: sourceId,
      result_url: result.url,
      extracted_facts: facts.length > 0 ? facts : null,
    });
  }

  emitProgress("corroborating");

  // ---- Stage 4: Corroborate ----
  const { corroboratedFacts, singleSourceFacts } = corroborateFacts(storedSources);

  // Mark corroborated sources in DB
  const corroboratedSourceIds = new Set<string>();
  for (const fact of corroboratedFacts) {
    for (const id of fact.source_ids) {
      corroboratedSourceIds.add(id);
    }
  }
  for (const sourceId of corroboratedSourceIds) {
    markSourceCorroborated(sourceId, true);
  }

  emitProgress("generating");

  // ---- Stage 5: Generate + Stage 6: Score ----
  const elementsCompleted: RewritableElementKey[] = [];
  const elementsFailed: RewritableElementKey[] = [];

  // Build base ScoreInput from current record for projected scoring
  let projectedScoreInput: ScoreInput = {
    has_photo: record.has_photo ?? null,
    bio_depth: record.bio_depth ?? null,
    treatments: record.treatments ?? [],
    qualifications_credentials: record.qualifications_credentials ?? null,
    specialty_primary: record.specialty_primary ?? [],
    specialty_sub: record.specialty_sub ?? [],
    insurers: record.insurers ?? [],
    consultation_times_raw: record.consultation_times_raw ?? [],
    plain_english_score: record.plain_english_score ?? null,
    booking_state: record.booking_state ?? null,
    online_bookable: record.online_bookable ?? null,
    practising_since: record.practising_since ?? null,
    memberships: record.memberships ?? [],
    available_slots_next_28_days: record.available_slots_next_28_days ?? null,
    gmc_code_for_booking: record.gmc_code_for_booking ?? null,
  };

  const currentScore = scoreConsultant(projectedScoreInput);

  // Handle photo element separately
  if (elements.includes("photo")) {
    try {
      await downloadConsultantPhoto(slug, consultantName, specialtyPrimary);
      // Photo download updates projected score — treat as has_photo = true
      projectedScoreInput = { ...projectedScoreInput, has_photo: true };
      elementsCompleted.push("photo");
    } catch (err) {
      console.warn(`[research-pipeline] Photo download failed for ${slug}: ${err}`);
      elementsFailed.push("photo");
    }
  }

  const rewritesByElement: Record<string, { content: string | null; sourceIds: string[]; delta: number | null }> = {};

  // Store photo result so the polling endpoint can surface it
  if (elementsCompleted.includes("photo")) {
    rewritesByElement["photo"] = { content: "Photo sourced from web search", sourceIds: [], delta: null };
  }

  for (const element of elements.filter((e) => e !== "photo")) {
    try {
      const originalContent = getOriginalContent(record, element);
      const exemplarContent = await getExemplarContent(run_id, specialtyPrimary, element);

      const rewriteResult = await generateRewrite({
        element,
        consultantName,
        specialtyPrimary,
        currentContent: originalContent,
        corroboratedFacts,
        singleSourceFacts,
        exemplarContent,
      });

      // Update projected score input for this element
      if (rewriteResult.rewritten_content !== null) {
        projectedScoreInput = applyRewriteToScoreInput(
          projectedScoreInput,
          element,
          rewriteResult.rewritten_content
        );
      }

      const projectedElementScore = scoreConsultant(projectedScoreInput);
      const delta = rewriteResult.rewritten_content !== null
        ? projectedElementScore.profile_completeness_score - currentScore.profile_completeness_score
        : null;

      const allSourceIds = [
        ...corroboratedFacts.filter((f) => f.element === element).flatMap((f) => f.source_ids),
        ...singleSourceFacts.filter((f) => f.element === element).flatMap((f) => f.source_ids),
      ];
      const uniqueSourceIds = [...new Set(allSourceIds)];

      rewritesByElement[element] = {
        content: rewriteResult.rewritten_content,
        sourceIds: uniqueSourceIds,
        delta,
      };

      elementsCompleted.push(element);
    } catch (err) {
      console.error(`[research-pipeline] Element "${element}" failed for ${slug}: ${err}`);
      elementsFailed.push(element);
    }
  }

  emitProgress("scoring");

  // ---- Stage 6: Final projected score ----
  const projectedResult = scoreConsultant(projectedScoreInput);

  // ---- Stage 7: Store ----
  emitProgress("storing");

  // Build corroboration summary
  const corrobSummary = corroboratedFacts.length > 0
    ? `${corroboratedFacts.length} facts corroborated across ${corroboratedSourceIds.size} sources. Elements covered: ${[...new Set(corroboratedFacts.map((f) => f.element))].join(", ")}.`
    : "No facts could be corroborated across multiple sources.";

  // Compute SEO scores (bio element or overall profile)
  const currentSeoInput = {
    about_text: record.about_text ?? null,
    treatments: record.treatments ?? [],
    specialty_primary: record.specialty_primary ?? [],
    hospital_name_primary: record.hospital_name_primary ?? null,
    plain_english_score: record.plain_english_score ?? null,
    qualifications_credentials: record.qualifications_credentials ?? null,
    memberships: record.memberships ?? [],
    practising_since: record.practising_since ?? null,
    clinical_interests: record.clinical_interests ?? [],
    personal_interests: record.personal_interests ?? null,
  };

  const proposedBioContent = rewritesByElement["bio"]?.content ?? null;
  const proposedSeoInput = {
    ...currentSeoInput,
    about_text: proposedBioContent ?? currentSeoInput.about_text,
    // If bio was rewritten, project plain_english_score improvement (matches applyRewriteToScoreInput)
    plain_english_score: proposedBioContent !== null ? 5 : currentSeoInput.plain_english_score,
  };

  const seoScoreBefore = calculateSeoScore(currentSeoInput).total;
  const seoScoreAfter = calculateSeoScore(proposedSeoInput).total;

  // Combine all source IDs used across elements
  const allUsedSourceIds = [
    ...new Set(
      Object.values(rewritesByElement).flatMap((r) => r.sourceIds)
    ),
  ];

  updateRewriteContent(rewrite_id, {
    rewritten_content: mode === "full"
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(rewritesByElement).map(([k, v]) => [k, v.content])
          )
        )
      : rewritesByElement[elements[0]]?.content ?? null,
    original_content: mode === "full"
      ? JSON.stringify(
          Object.fromEntries(
            elements.map((e) => [e, getOriginalContent(record, e)])
          )
        )
      : getOriginalContent(record, elements[0]),
    source_ids: allUsedSourceIds,
    corroboration_summary: corrobSummary,
    projected_score_delta: projectedResult.profile_completeness_score - currentScore.profile_completeness_score,
    projected_total_score: projectedResult.profile_completeness_score,
    projected_tier: projectedResult.quality_tier,
    seo_score_before: seoScoreBefore,
    seo_score_after: seoScoreAfter,
  });

  emitProgress("complete");

  return {
    rewrite_id,
    slug,
    elements_completed: elementsCompleted,
    elements_failed: elementsFailed,
    projected_total_score: projectedResult.profile_completeness_score,
    projected_tier: projectedResult.quality_tier,
    error: null,
    search_errors: searchErrors,
  };
}

// ============================================================
// Batch pipeline
// ============================================================

/**
 * Process multiple consultants sequentially through the research pipeline.
 * Failure on one consultant does not stop the batch. Per spec §4.2.
 */
export async function* runBatchPipeline(
  slugs: string[],
  run_id: string,
  mode: "full" | "element" = "full",
  elements?: RewritableElementKey[]
): AsyncGenerator<BatchProgress> {
  const allElements: RewritableElementKey[] = elements ?? [
    "bio", "treatments", "qualifications", "specialty_sub",
    "memberships", "practising_since", "clinical_interests",
    "personal_interests", "photo",
  ];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const rewrite_id = randomUUID();
    const now = new Date().toISOString();

    yield {
      current: i + 1,
      total: slugs.length,
      slug,
      status: "in_progress",
    };

    // Create initial rewrite record
    insertRewrite({
      rewrite_id,
      run_id,
      slug,
      rewrite_mode: mode,
      element_key: mode === "element" && allElements.length === 1 ? allElements[0] : null,
      original_content: null,
      rewritten_content: null,
      source_ids: null,
      corroboration_summary: null,
      projected_score_delta: null,
      projected_total_score: null,
      projected_tier: null,
      status: "draft",
      seo_score_before: null,
      seo_score_after: null,
      created_at: now,
      reviewed_by: null,
      reviewed_at: null,
    });

    try {
      const result = await runResearchPipeline({
        slug,
        run_id,
        rewrite_id,
        elements: allElements,
        mode,
      });

      yield {
        current: i + 1,
        total: slugs.length,
        slug,
        status: result.error ? "failed" : "complete",
        result,
      };
    } catch (err) {
      console.error(`[research-pipeline] Batch: fatal error for ${slug}: ${err}`);

      yield {
        current: i + 1,
        total: slugs.length,
        slug,
        status: "failed",
        result: {
          rewrite_id,
          slug,
          elements_completed: [],
          elements_failed: allElements,
          projected_total_score: null,
          projected_tier: null,
          error: err instanceof Error ? err.message : String(err),
          search_errors: [],
        },
      };
    }
  }
}
