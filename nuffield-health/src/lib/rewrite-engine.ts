import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { ANTHROPIC_API_KEY } from "@/lib/config";
import { SUPERLATIVE_BLOCKLIST } from "@/lib/types";
import type { SeoScoreBreakdown, RewritableElementKey } from "@/lib/types";
import type { FactWithSources } from "@/lib/corroboration";


const MODEL = "claude-haiku-4-5-20251001";
const GENERATION_TEMPERATURE = 0.2;

// Zod schemas for validating Haiku generation output
const bioOutputSchema = z.union([z.string().min(50).max(2000), z.null()]);
const listOutputSchema = z.union([z.array(z.string()).min(1), z.null()]);
const yearOutputSchema = z.union([z.number().int().min(1950).max(2024), z.null()]);

export interface RewriteParams {
  element: RewritableElementKey;
  consultantName: string;
  specialtyPrimary: string;
  currentContent: string | null;
  corroboratedFacts: FactWithSources[];
  singleSourceFacts: FactWithSources[];
  exemplarContent: string | null;
}

export interface RewriteResult {
  rewritten_content: string | null;
  validation_passed: boolean;
  blocked_terms: string[];
  error: string | null;
}

export interface ValidationResult {
  passed: boolean;
  blocked_terms: string[];
}

export interface SeoInput {
  about_text: string | null;
  treatments: string[];
  specialty_primary: string[];
  hospital_name_primary: string | null;
  plain_english_score: number | null;
  qualifications_credentials: string | null;
  memberships: string[];
  practising_since: number | null;
  clinical_interests: string[];
  personal_interests: string | null;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return client;
}

function elementLabel(element: RewritableElementKey): string {
  const labels: Record<RewritableElementKey, string> = {
    bio: "biography",
    treatments: "treatments list",
    qualifications: "qualifications and credentials",
    specialty_sub: "sub-specialties",
    memberships: "professional memberships",
    practising_since: "year first practising",
    clinical_interests: "clinical interests",
    personal_interests: "personal interests",
    photo: "photo",
  };
  return labels[element];
}

function maxTokensForElement(element: RewritableElementKey): number {
  return element === "bio" ? 2000 : 500;
}

function buildGenerationPrompt(params: RewriteParams): string {
  const {
    element,
    consultantName,
    specialtyPrimary,
    currentContent,
    corroboratedFacts,
    singleSourceFacts,
    exemplarContent,
  } = params;

  const elementFacts = (facts: FactWithSources[]) =>
    facts
      .filter((f) => f.element === element || element === "bio")
      .map((f) => `- ${f.fact}`)
      .join("\n") || "(none)";

  return `You are a medical copywriter improving a healthcare consultant's profile for a hospital website.

CONSULTANT: ${consultantName}
SPECIALTY: ${specialtyPrimary}
CURRENT ${elementLabel(element).toUpperCase()}: ${currentContent ?? "null"}

CORROBORATED FACTS (confirmed in 2+ sources):
${elementFacts(corroboratedFacts)}

SINGLE-SOURCE FACTS (use with caution, mark if used):
${elementFacts(singleSourceFacts)}

EXEMPLAR (Gold-tier profile for reference):
${exemplarContent ?? "(no exemplar available)"}

Write an improved ${elementLabel(element)} for this consultant.

Rules:
${currentContent !== null
    ? `- The current content above is TRUSTED — you may use all facts from it freely
- Enrich the rewrite with any additional corroborated or single-source facts where relevant
- Do not invent facts beyond what is in the current content or the fact lists above
- You MUST produce a rewrite — do not return null when current content exists`
    : `- Use ONLY the facts provided — do not invent any information
- If insufficient facts exist to write this element, return exactly: null`}
- Write in plain English: replace medical jargon with patient-friendly explanations (e.g. "hip replacement" not "arthroplasty", "keyhole surgery" not "arthroscopy")
- Where a medical term must be used, follow it with a brief plain-English explanation in brackets
- Target reading level: accessible to a general adult audience (aim for a reading age of 12-14)
- Keep the tone professional, warm, and reassuring
- For biography: 150-300 words, third person, include clinical background, patient focus, and mention the hospital location
- For lists (treatments, memberships, etc.): return a JSON array of strings
- If you use any single-source fact, append "(unverified)" after it
- Do not include superlatives ("best", "leading", "top") — state facts only`;
}

function zodSchemaForElement(element: RewritableElementKey) {
  switch (element) {
    case "bio":
    case "qualifications":
    case "personal_interests":
      return bioOutputSchema;
    case "treatments":
    case "specialty_sub":
    case "memberships":
    case "clinical_interests":
      return listOutputSchema;
    case "practising_since":
      return yearOutputSchema;
    default:
      return bioOutputSchema;
  }
}

function parseGenerationOutput(raw: string, element: RewritableElementKey): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```$/i, "")
    .trim();

  if (cleaned === "null") return null;

  // List elements expect JSON arrays
  if (
    element === "treatments" ||
    element === "specialty_sub" ||
    element === "memberships" ||
    element === "clinical_interests"
  ) {
    try {
      return JSON.parse(cleaned);
    } catch {
      // Maybe Haiku returned a plain text list — split by newlines or commas
      return cleaned
        .split(/[\n,]+/)
        .map((s) => s.replace(/^[-•*]\s*/, "").trim())
        .filter((s) => s.length > 0);
    }
  }

  if (element === "practising_since") {
    const match = cleaned.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : null;
  }

  return cleaned;
}

/**
 * Validate generated content against the superlative blocklist.
 * Per spec §11.3.
 */
export function validateContent(content: string): ValidationResult {
  const lower = content.toLowerCase();
  const blocked: string[] = [];

  for (const term of SUPERLATIVE_BLOCKLIST) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lower)) {
      blocked.push(term);
    }
  }

  return { passed: blocked.length === 0, blocked_terms: blocked };
}

/**
 * Calculate SEO score for a profile. Per spec §10.1.
 */
export function calculateSeoScore(profile: SeoInput): SeoScoreBreakdown {
  let keyword_richness = 0;
  let content_length = 0;
  let patient_language = 0;
  let structured_completeness = 0;
  let location_signals = 0;

  const bio = profile.about_text ?? "";

  // Keyword richness (30 pts): bio mentions conditions, treatments, or symptoms
  if (bio.length > 0) {
    const treatmentKeywords = profile.treatments.join(" ").toLowerCase();
    const clinicalKeywords = profile.clinical_interests.join(" ").toLowerCase();
    const bioLower = bio.toLowerCase();

    // Count distinct medical terms found in bio from treatments and clinical interests
    const allKeywords = [
      ...profile.treatments,
      ...profile.clinical_interests,
      ...profile.specialty_primary,
    ];

    const matchedCount = allKeywords.filter((kw) =>
      bioLower.includes(kw.toLowerCase())
    ).length;

    const totalKeywords = allKeywords.length;
    if (totalKeywords > 0) {
      keyword_richness = Math.min(30, Math.round((matchedCount / Math.max(totalKeywords, 1)) * 30));
    } else {
      // No keywords to match — award partial points if bio exists
      keyword_richness = bio.length > 0 ? 10 : 0;
    }

    // Also check treatment/clinical keywords are mentioned even without lists
    if (treatmentKeywords.length > 0 || clinicalKeywords.length > 0) {
      keyword_richness = Math.max(keyword_richness, 5);
    }
  }

  // Content length (20 pts): bio word count
  const wordCount = bio.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount >= 300) {
    content_length = 20;
  } else if (wordCount >= 150) {
    content_length = 10;
  } else {
    content_length = 0;
  }

  // Patient language (20 pts): reuse plain_english_score
  const pes = profile.plain_english_score;
  if (pes !== null) {
    if (pes >= 4) {
      patient_language = 20;
    } else if (pes === 3) {
      patient_language = 10;
    } else {
      patient_language = 0;
    }
  }

  // Structured data completeness (20 pts): proportion of scored elements populated
  // Scored elements: bio, treatments, qualifications, memberships, practising_since, specialty
  const scoredElements = [
    bio.length > 0,
    profile.treatments.length > 0,
    profile.qualifications_credentials !== null,
    profile.memberships.length > 0,
    profile.practising_since !== null,
    profile.specialty_primary.length > 0,
  ];
  const populatedCount = scoredElements.filter(Boolean).length;
  structured_completeness = Math.round((populatedCount / scoredElements.length) * 20);

  // Location signals (10 pts): bio mentions hospital location, nearby areas, or regions
  const locationTerms = [
    "london", "manchester", "birmingham", "bristol", "leeds", "edinburgh",
    "glasgow", "cardiff", "oxford", "cambridge", "hospital", "clinic",
    "nuffield", "harley street", "surrey", "kent", "essex", "hertfordshire",
    ...(profile.hospital_name_primary ? [profile.hospital_name_primary.toLowerCase()] : []),
  ];
  const bioLower = bio.toLowerCase();
  const hasLocationSignal = locationTerms.some((term) => bioLower.includes(term));
  location_signals = hasLocationSignal ? 10 : 0;

  const total = keyword_richness + content_length + patient_language + structured_completeness + location_signals;

  return {
    keyword_richness,
    content_length,
    patient_language,
    structured_completeness,
    location_signals,
    total: Math.min(100, total),
  };
}

/**
 * Generate a rewrite for a single profile element using Claude Haiku.
 * Validates output against superlative blocklist and retries once on failure.
 * Returns null content if insufficient data or both attempts fail.
 *
 * Per spec §5.2, §11.
 */
export async function generateRewrite(params: RewriteParams): Promise<RewriteResult> {
  const anthropic = getClient();
  const prompt = buildGenerationPrompt(params);
  const maxTokens = maxTokensForElement(params.element);
  const schema = zodSchemaForElement(params.element);
  const hasExistingContent = params.currentContent !== null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: GENERATION_TEMPERATURE,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Haiku response");
      }

      const raw = textBlock.text.trim();
      const parsed = parseGenerationOutput(raw, params.element);
      const validated = schema.parse(parsed);

      if (validated === null) {
        if (hasExistingContent && attempt === 0) {
          // Haiku returned null but content exists — retry (prompt says don't return null)
          continue;
        }
        if (hasExistingContent) {
          // Still null after retry — fall back to current content as-is
          // (better to return existing content than show "insufficient data")
          return { rewritten_content: params.currentContent, validation_passed: true, blocked_terms: [], error: null };
        }
        // No existing content and Haiku says insufficient data — that's correct
        return { rewritten_content: null, validation_passed: true, blocked_terms: [], error: null };
      }

      // Serialize the validated output
      const content =
        typeof validated === "string"
          ? validated
          : typeof validated === "number"
          ? String(validated)
          : JSON.stringify(validated);

      // Superlative blocklist check
      const validation = validateContent(content);
      if (!validation.passed) {
        if (attempt === 0) {
          // Retry once on blocklist failure
          continue;
        }
        // Second attempt still has superlatives — return null per spec
        return {
          rewritten_content: null,
          validation_passed: false,
          blocked_terms: validation.blocked_terms,
          error: `Content contains blocked terms: ${validation.blocked_terms.join(", ")}`,
        };
      }

      return {
        rewritten_content: content,
        validation_passed: true,
        blocked_terms: [],
        error: null,
      };
    } catch (err) {
      if (attempt === 0) {
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        rewritten_content: null,
        validation_passed: false,
        blocked_terms: [],
        error: `Generation failed: ${message}`,
      };
    }
  }

  // Safety fallback
  return {
    rewritten_content: null,
    validation_passed: false,
    blocked_terms: [],
    error: "Generation failed after 2 attempts",
  };
}
