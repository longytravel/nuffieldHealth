import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { ANTHROPIC_API_KEY } from "@/lib/config";

const MODEL = "claude-haiku-4-5-20251001";

const aiExecutiveReportSchema = z.object({
  board_headline: z.string(),
  executive_summary: z.string(),
  strengths: z.array(z.string()).min(3).max(6),
  risks: z.array(z.string()).min(3).max(6),
  key_actions: z.array(
    z.object({
      action: z.string(),
      rationale: z.string(),
      expected_impact: z.string(),
      time_horizon: z.string(),
    })
  ).min(3).max(6),
  board_questions: z.array(z.string()).min(3).max(5),
  confidence_note: z.string(),
});

type AiExecutiveReportResponse = z.infer<typeof aiExecutiveReportSchema>;

export interface AiExecutiveReport {
  boardHeadline: string;
  executiveSummary: string;
  strengths: string[];
  risks: string[];
  keyActions: {
    action: string;
    rationale: string;
    expectedImpact: string;
    timeHorizon: string;
  }[];
  boardQuestions: string[];
  confidenceNote: string;
  source: "claude-haiku" | "fallback";
}

export interface AiExecutiveReportInput {
  runId: string;
  runDate: string;
  kpis: {
    totalProfiles: number;
    avgScore: number;
    goldPct: number;
    bookableCount: number;
    needsReview: number;
    avgPlainEnglish: number;
    missingPhotos: number;
    avgPrice: number | null;
  };
  tierCounts: {
    Gold: number;
    Silver: number;
    Bronze: number;
    Incomplete: number;
  };
  quickActions: {
    description: string;
    profilesAffected: number;
    potentialUplift: number;
    totalImpact: number;
  }[];
  impactSummary: {
    currentAvgScore: number;
    projectedAvgScore: number;
    currentGoldPct: number;
    projectedGoldPct: number;
    totalProfiles: number;
  };
  topHospitals: {
    hospitalName: string;
    consultantCount: number;
    avgScore: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    incompleteCount: number;
  }[];
  topSpecialties: {
    specialty: string;
    consultantCount: number;
    avgScore: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    incompleteCount: number;
    photoPct: number;
    bookablePct: number;
  }[];
  topPerformers: {
    consultantName: string;
    hospitalName: string;
    score: number | null;
    qualityTier: string | null;
  }[];
  atRiskProfiles: {
    consultantName: string;
    hospitalName: string;
    score: number | null;
    qualityTier: string | null;
    hasPhoto: boolean | null;
    bioDepth: string | null;
    insurerCount: number | null;
  }[];
}

const PROMPT = `You are an executive healthcare analytics report writer.
You will receive run metrics from a consultant profile quality platform.

Rules:
1. Use only the provided data. Do not invent metrics.
2. Keep writing concise and board-ready.
3. Every action must map to concrete data patterns.
4. Return valid JSON only, no markdown.

Required JSON format:
{
  "board_headline": "<single sentence>",
  "executive_summary": "<120-220 words>",
  "strengths": ["<string>", "..."],
  "risks": ["<string>", "..."],
  "key_actions": [
    {
      "action": "<clear action title>",
      "rationale": "<why this matters from the data>",
      "expected_impact": "<quantified or directional impact>",
      "time_horizon": "<0-30 days|30-90 days|90+ days>"
    }
  ],
  "board_questions": ["<string>", "..."],
  "confidence_note": "<1-2 sentence note on evidence quality and confidence>"
}`;

function fallbackReport(input: AiExecutiveReportInput): AiExecutiveReport {
  const topAction = input.quickActions[0];
  const actionText = topAction
    ? `${topAction.description} (${topAction.profilesAffected} profiles, +${topAction.totalImpact} potential points)`
    : "No high-impact action identified";

  const incomplete = input.tierCounts.Incomplete;

  return {
    boardHeadline: `Run ${input.runId.slice(0, 8)} shows ${input.kpis.avgScore.toFixed(1)}/100 average quality with ${input.kpis.goldPct.toFixed(1)}% Gold profiles.`,
    executiveSummary:
      `This run covers ${input.kpis.totalProfiles} consultant profiles with an average score of ${input.kpis.avgScore.toFixed(1)}. ` +
      `${input.tierCounts.Gold} profiles are Gold and ${incomplete} remain Incomplete. ` +
      `${input.kpis.bookableCount} consultants are bookable with slots. ` +
      `The strongest immediate opportunity is ${actionText}. ` +
      `If prioritized actions are executed, modeled average score could move from ${input.impactSummary.currentAvgScore.toFixed(1)} to ${input.impactSummary.projectedAvgScore.toFixed(1)} and Gold share from ${input.impactSummary.currentGoldPct.toFixed(1)}% to ${input.impactSummary.projectedGoldPct.toFixed(1)}%.`,
    strengths: [
      `${input.tierCounts.Gold} profiles already meet Gold quality standards.`,
      `${input.kpis.bookableCount} consultants are currently bookable with available slots.`,
      `Average plain English score is ${input.kpis.avgPlainEnglish.toFixed(1)}/5, indicating generally patient-readable copy.`,
    ],
    risks: [
      `${incomplete} profiles remain in the Incomplete tier, creating patient trust and conversion risk.`,
      `${input.kpis.needsReview} profiles require manual review due to fail/low-confidence signals.`,
      `${input.kpis.missingPhotos} profiles still lack photos, reducing profile completeness and conversion confidence.`,
    ],
    keyActions: input.quickActions.slice(0, 4).map((a) => ({
      action: a.description,
      rationale: `${a.profilesAffected} profiles currently miss this criterion.`,
      expectedImpact: `Potential total uplift of +${a.totalImpact} score points across the run.`,
      timeHorizon: "0-30 days",
    })),
    boardQuestions: [
      "Which hospitals should be prioritized first based on concentration of incomplete profiles?",
      "What operating model will ensure top actions are completed within the next 30 days?",
      "Should minimum profile quality gates be enforced before consultants are shown in key digital journeys?",
    ],
    confidenceNote:
      "Narrative generated from deterministic run metrics with rule-based fallback. Confidence is high for numeric trends and medium for causal interpretation.",
    source: "fallback",
  };
}

let client: Anthropic | null = null;
const memo = new Map<string, AiExecutiveReport>();

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return client;
}

export async function generateAiExecutiveReport(
  input: AiExecutiveReportInput
): Promise<AiExecutiveReport> {
  // Basic in-memory memoization by run to avoid repeated model calls per page refresh.
  const cacheKey = input.runId;
  const cached = memo.get(cacheKey);
  if (cached) return cached;

  if (!ANTHROPIC_API_KEY) {
    const fallback = fallbackReport(input);
    memo.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const anthropic = getClient();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: PROMPT,
      messages: [
        {
          role: "user",
          content: `Create the report from this JSON context:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in AI response");
    }

    const raw = textBlock.text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    const validated: AiExecutiveReportResponse = aiExecutiveReportSchema.parse(parsed);

    const aiReport: AiExecutiveReport = {
      boardHeadline: validated.board_headline,
      executiveSummary: validated.executive_summary,
      strengths: validated.strengths,
      risks: validated.risks,
      keyActions: validated.key_actions.map((a) => ({
        action: a.action,
        rationale: a.rationale,
        expectedImpact: a.expected_impact,
        timeHorizon: a.time_horizon,
      })),
      boardQuestions: validated.board_questions,
      confidenceNote: validated.confidence_note,
      source: "claude-haiku",
    };

    memo.set(cacheKey, aiReport);
    return aiReport;
  } catch {
    const fallback = fallbackReport(input);
    memo.set(cacheKey, fallback);
    return fallback;
  }
}
