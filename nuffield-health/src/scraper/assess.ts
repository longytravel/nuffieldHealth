import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { ANTHROPIC_API_KEY } from "@/lib/config";
import { AiAssessmentError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const MODEL = "claude-haiku-4-5-20251001";

// Zod schema for validating the AI response
export const assessmentResponseSchema = z.object({
  plain_english_score: z.number().int().min(1).max(5),
  plain_english_reason: z.string(),
  bio_depth: z.enum(["substantive", "adequate", "thin", "missing"]),
  bio_depth_reason: z.string(),
  treatment_specificity_score: z.enum([
    "highly_specific",
    "moderately_specific",
    "generic",
    "not_applicable",
  ]),
  treatment_specificity_reason: z.string(),
  qualifications_completeness: z.enum(["comprehensive", "adequate", "minimal", "missing"]),
  qualifications_completeness_reason: z.string(),
  inferred_sub_specialties: z.array(z.string()),
  personal_interests: z.string().nullable(),
  professional_interests: z.string().nullable(),
  clinical_interests: z.array(z.string()),
  languages: z.array(z.string()),
  declaration_substantive: z.boolean(),
  overall_quality_notes: z.string(),
});

export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;

// Null result when AI assessment fails — pipeline must not crash
export const NULL_ASSESSMENT: AssessmentResponse = {
  plain_english_score: 1,
  plain_english_reason: "AI assessment failed",
  bio_depth: "missing",
  bio_depth_reason: "AI assessment failed",
  treatment_specificity_score: "not_applicable",
  treatment_specificity_reason: "AI assessment failed",
  qualifications_completeness: "missing",
  qualifications_completeness_reason: "AI assessment failed",
  inferred_sub_specialties: [],
  personal_interests: null,
  professional_interests: null,
  clinical_interests: [],
  languages: [],
  declaration_substantive: false,
  overall_quality_notes: "AI assessment failed — fields set to defaults",
};

const SYSTEM_PROMPT = `You are a healthcare profile quality assessor. You receive the text content of a consultant's profile page from a private hospital website. Your job is to assess the quality and completeness of the profile content.

You MUST respond with a valid JSON object matching this exact schema — no markdown, no explanation, just JSON:

{
  "plain_english_score": <integer 1-5>,
  "plain_english_reason": "<brief explanation>",
  "bio_depth": "<substantive|adequate|thin|missing>",
  "bio_depth_reason": "<brief explanation>",
  "treatment_specificity_score": "<highly_specific|moderately_specific|generic|not_applicable>",
  "treatment_specificity_reason": "<brief explanation>",
  "qualifications_completeness": "<comprehensive|adequate|minimal|missing>",
  "qualifications_completeness_reason": "<brief explanation>",
  "inferred_sub_specialties": ["<string>", ...],
  "personal_interests": "<string or null — hobbies, sport, non-work activities>",
  "professional_interests": "<string or null — teaching, research leadership, committee roles, course organisation>",
  "clinical_interests": ["<string>", ...],
  "languages": ["<string>", ...],
  "declaration_substantive": <true if declaration contains actual financial interests/ownership, false if boilerplate or missing>,
  "overall_quality_notes": "<brief overall assessment including any anomalies, typos, or artifacts detected>"
}

Scoring guide:
- plain_english_score: 1=jargon-heavy/unreadable, 2=mostly medical language, 3=mixed, 4=mostly plain English, 5=fully accessible to patients
- bio_depth: "substantive"=detailed background with experience/approach, "adequate"=reasonable but brief, "thin"=minimal/sparse, "missing"=no bio/about section
- treatment_specificity: "highly_specific"=named procedures/conditions, "moderately_specific"=broad categories with some detail, "generic"=vague/general terms only, "not_applicable"=no treatments section
- qualifications_completeness: "comprehensive"=multiple qualifications, training institutions named, fellowships/awards listed; "adequate"=basic qualifications with some detail; "minimal"=bare minimum (degree only); "missing"=no qualifications section
- declaration_substantive: true if the declaration section mentions actual financial interests, equipment ownership, partnerships, or investments; false if it says "no interests to declare" or similar boilerplate, or if there is no declaration section
- Interest classification: clinical=medical conditions, procedures, surgical techniques; professional=teaching, research, committee work, editorial roles, course organisation; personal=hobbies, sport, family, non-work activities`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Assess a consultant profile using Claude Haiku.
 * Validates the response with Zod. Retries once on validation failure.
 * Never crashes the pipeline — returns null assessment fields on failure.
 */
export async function assessProfile(
  profileText: string,
  slug: string,
  progress?: { current: number; total: number }
): Promise<AssessmentResponse> {
  const anthropic = getClient();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Assess this consultant profile:\n\n${profileText}`,
          },
        ],
      });

      // Extract text content from the response
      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in AI response");
      }

      const rawJson = textBlock.text.trim();
      // Strip markdown code fences if present
      const cleaned = rawJson.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```$/i, "");
      const parsed = JSON.parse(cleaned);
      const validated = assessmentResponseSchema.parse(parsed);

      logger.info("AI", slug, "success", `score=${validated.plain_english_score}, bio=${validated.bio_depth}`, progress);
      return validated;
    } catch (error) {
      if (attempt === 0) {
        logger.warn("AI", slug, "retry", `validation failed, attempt 2/2`, progress);
        continue;
      }

      // Second attempt failed — log and return null assessment
      logger.error(
        "AI",
        slug,
        "error",
        `AI assessment failed: ${error instanceof Error ? error.message : String(error)}`,
        progress
      );
      return { ...NULL_ASSESSMENT };
    }
  }

  // Should not reach here, but safety fallback
  return { ...NULL_ASSESSMENT };
}
