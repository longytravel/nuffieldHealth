import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db/index";
import { consultants } from "@/db/schema";
import { eq, and, like, sql, desc, asc, or } from "drizzle-orm";
import {
  getDashboardKPIs,
  getQualityTierDistribution,
  getHospitalBenchmarks,
  getSpecialtyAnalysis,
  getQuickActions,
  getLatestRun,
} from "@/db/queries";

const anthropic = new Anthropic();

// ── Tool definitions for Anthropic tool use ──

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_consultants",
    description:
      "Search the consultant database with filters. Returns matching consultant profiles. Use this when the user asks about specific consultants, wants a list filtered by hospital/specialty/tier, or needs individual-level data.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Filter by consultant name (partial match)",
        },
        hospital: {
          type: "string",
          description: "Filter by hospital name (partial match)",
        },
        specialty: {
          type: "string",
          description: "Filter by specialty (exact match against the specialty array)",
        },
        quality_tier: {
          type: "string",
          enum: ["Gold", "Silver", "Bronze", "Incomplete"],
          description: "Filter by quality tier",
        },
        booking_state: {
          type: "string",
          description: "Filter by booking state, e.g. 'bookable_with_slots', 'not_bookable'",
        },
        has_photo: {
          type: "boolean",
          description: "Filter by whether the consultant has a photo",
        },
        score_min: {
          type: "number",
          description: "Minimum profile completeness score",
        },
        score_max: {
          type: "number",
          description: "Maximum profile completeness score",
        },
        sort_by: {
          type: "string",
          enum: ["score_asc", "score_desc", "name_asc", "price_desc", "price_asc"],
          description: "How to sort results. Default: name_asc",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_consultant_detail",
    description:
      "Get full profile details for a specific consultant by their slug or name. Use this when the user asks about a specific person.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description: "The consultant slug (e.g. 'mr-john-smith')",
        },
        name: {
          type: "string",
          description: "The consultant name to search for (partial match)",
        },
      },
      required: [],
    },
  },
];

// ── Tool execution ──

function executeSearchConsultants(
  runId: string,
  params: {
    name?: string;
    hospital?: string;
    specialty?: string;
    quality_tier?: string;
    booking_state?: string;
    has_photo?: boolean;
    score_min?: number;
    score_max?: number;
    sort_by?: string;
    limit?: number;
  }
) {
  const conditions = [eq(consultants.run_id, runId)];

  if (params.name) {
    conditions.push(like(consultants.consultant_name, `%${params.name}%`));
  }
  if (params.hospital) {
    conditions.push(like(consultants.hospital_name_primary, `%${params.hospital}%`));
  }
  if (params.quality_tier) {
    conditions.push(eq(consultants.quality_tier, params.quality_tier));
  }
  if (params.booking_state) {
    conditions.push(eq(consultants.booking_state, params.booking_state));
  }
  if (params.has_photo !== undefined) {
    conditions.push(sql`${consultants.has_photo} = ${params.has_photo ? 1 : 0}`);
  }
  if (params.score_min !== undefined) {
    conditions.push(sql`${consultants.profile_completeness_score} >= ${params.score_min}`);
  }
  if (params.score_max !== undefined) {
    conditions.push(sql`${consultants.profile_completeness_score} <= ${params.score_max}`);
  }
  if (params.specialty) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${consultants.specialty_primary}) WHERE value = ${params.specialty})`
    );
  }

  let orderBy;
  switch (params.sort_by) {
    case "score_desc":
      orderBy = desc(consultants.profile_completeness_score);
      break;
    case "score_asc":
      orderBy = asc(consultants.profile_completeness_score);
      break;
    case "price_desc":
      orderBy = desc(consultants.consultation_price);
      break;
    case "price_asc":
      orderBy = asc(consultants.consultation_price);
      break;
    default:
      orderBy = asc(consultants.consultant_name);
  }

  const maxResults = Math.min(params.limit ?? 20, 50);

  const rows = db
    .select({
      consultant_name: consultants.consultant_name,
      slug: consultants.slug,
      hospital_name_primary: consultants.hospital_name_primary,
      specialty_primary: consultants.specialty_primary,
      quality_tier: consultants.quality_tier,
      profile_completeness_score: consultants.profile_completeness_score,
      plain_english_score: consultants.plain_english_score,
      bio_depth: consultants.bio_depth,
      has_photo: consultants.has_photo,
      booking_state: consultants.booking_state,
      consultation_price: consultants.consultation_price,
      insurer_count: consultants.insurer_count,
      online_bookable: consultants.online_bookable,
      available_slots_next_28_days: consultants.available_slots_next_28_days,
    })
    .from(consultants)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(maxResults)
    .all();

  // Also get total count for the filter
  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(consultants)
    .where(and(...conditions))
    .get();

  return {
    total_matching: countRow?.count ?? 0,
    returned: rows.length,
    consultants: rows,
  };
}

function executeGetConsultantDetail(
  runId: string,
  params: { slug?: string; name?: string }
) {
  const conditions = [eq(consultants.run_id, runId)];

  if (params.slug) {
    conditions.push(eq(consultants.slug, params.slug));
  } else if (params.name) {
    conditions.push(like(consultants.consultant_name, `%${params.name}%`));
  } else {
    return { error: "Provide either slug or name" };
  }

  const row = db
    .select({
      consultant_name: consultants.consultant_name,
      consultant_title_prefix: consultants.consultant_title_prefix,
      slug: consultants.slug,
      profile_url: consultants.profile_url,
      hospital_name_primary: consultants.hospital_name_primary,
      specialty_primary: consultants.specialty_primary,
      quality_tier: consultants.quality_tier,
      profile_completeness_score: consultants.profile_completeness_score,
      plain_english_score: consultants.plain_english_score,
      plain_english_reason: consultants.plain_english_reason,
      bio_depth: consultants.bio_depth,
      bio_depth_reason: consultants.bio_depth_reason,
      treatment_specificity_score: consultants.treatment_specificity_score,
      treatment_specificity_reason: consultants.treatment_specificity_reason,
      qualifications_completeness: consultants.qualifications_completeness,
      has_photo: consultants.has_photo,
      booking_state: consultants.booking_state,
      consultation_price: consultants.consultation_price,
      insurer_count: consultants.insurer_count,
      online_bookable: consultants.online_bookable,
      available_slots_next_28_days: consultants.available_slots_next_28_days,
      next_available_date: consultants.next_available_date,
      clinical_interests: consultants.clinical_interests,
      languages: consultants.languages,
      practising_since: consultants.practising_since,
      registration_number: consultants.registration_number,
      ai_quality_notes: consultants.ai_quality_notes,
      flags: consultants.flags,
    })
    .from(consultants)
    .where(and(...conditions))
    .limit(1)
    .get();

  if (!row) {
    return { error: "Consultant not found" };
  }

  return row;
}

function executeTool(runId: string, toolName: string, toolInput: Record<string, unknown>) {
  switch (toolName) {
    case "search_consultants":
      return executeSearchConsultants(runId, toolInput);
    case "get_consultant_detail":
      return executeGetConsultantDetail(runId, toolInput as { slug?: string; name?: string });
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ── System prompt (summary data for general questions) ──

async function buildSystemPrompt(runId: string): Promise<string> {
  const kpis = getDashboardKPIs(runId);
  const tiers = await getQualityTierDistribution(runId);
  const hospitals = getHospitalBenchmarks(runId);
  const specialties = getSpecialtyAnalysis(runId);
  const actions = getQuickActions(runId);

  const tierSummary = tiers
    .map((t) => `${t.quality_tier}: ${t.count}`)
    .join(", ");

  const hospitalSummary = hospitals
    .map((h) => `${h.hospitalName}: ${h.consultantCount} consultants, avg ${h.avgScore}, Gold ${h.goldCount}, Silver ${h.silverCount}, Bronze ${h.bronzeCount}, Incomplete ${h.incompleteCount}, ${h.photoPct}% photos, ${h.bookablePct}% bookable, top specialty: ${h.topSpecialty ?? "N/A"}`)
    .join("\n");

  const specialtySummary = specialties
    .map((s) => `${s.specialty}: ${s.consultantCount} consultants, avg ${s.avgScore}, Gold ${s.goldCount}, Silver ${s.silverCount}, Bronze ${s.bronzeCount}, ${s.photoPct}% photos, ${s.bookablePct}% bookable, plain English ${s.avgPlainEnglish}/5`)
    .join("\n");

  const actionSummary = actions
    .map((a) => `- ${a.description}: ${a.profilesAffected} profiles, +${a.potentialUplift} pts each, total impact +${a.totalImpact} pts`)
    .join("\n");

  return `You are SensAI Copilot, an AI assistant for the SensAI Consultant Intelligence Platform.
You help Nuffield Health stakeholders understand consultant profile quality data.

You have access to the COMPLETE latest scrape run data, plus tools to query individual consultant records.

## Key Performance Indicators
- Total Profiles: ${kpis.totalProfiles}
- Average Score: ${kpis.avgScore}/100
- Gold Tier: ${kpis.goldPct}%
- Bookable Consultants: ${kpis.bookableCount}
- Needs Review: ${kpis.needsReview}
- Average Plain English Score: ${kpis.avgPlainEnglish}/5
- Missing Photos: ${kpis.missingPhotos}
- Average Consultation Price: ${kpis.avgPrice !== null ? `£${kpis.avgPrice}` : "N/A"}

## Quality Tier Distribution
${tierSummary}

## All Hospitals (${hospitals.length} total)
${hospitalSummary}

## All Specialties (${specialties.length} total)
${specialtySummary}

## Top Improvement Actions
${actionSummary}

## Scoring System
- Profiles scored 0-100 based on: photo, bio depth, qualifications, insurers, consultation times, memberships, plain English, treatment specificity
- Tiers: Gold (>=80), Silver (>=60), Bronze (>=40), Incomplete (<40)

## Tools
You have two tools available:
- **search_consultants**: Use this when you need to find specific consultants matching criteria (e.g. "Bronze cardiologists in London", "cheapest consultants", "who has no photo"). Returns actual consultant rows from the database.
- **get_consultant_detail**: Use this to get full details on a specific consultant by name or slug.

ALWAYS use tools when the question requires individual consultant data. The summary data above is for aggregate/overview questions only.

## Guidelines
- Be concise and data-driven. Always cite specific numbers.
- Use the search tool for ANY question about specific consultants, lists, or filtered data.
- Format responses clearly. Use bullet points and tables where helpful.
- Keep responses under 250 words.
- When linking to pages, use: Consultant Explorer /consultants, Hospitals /hospitals, Specialties /specialties.
- Use British English spelling (e.g. "colour", "analyse", "speciality").`;
}

// ── API handler with tool use loop ──

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const latestRun = await getLatestRun();
    if (!latestRun) {
      return NextResponse.json({
        content: "No completed scrape runs found. Please run the pipeline first to generate data for me to analyse.",
      });
    }

    const runId = latestRun.run_id;
    const systemPrompt = await buildSystemPrompt(runId);

    // Convert to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    // Tool use loop — keep calling until we get a final text response
    let currentMessages = [...anthropicMessages];
    const MAX_TOOL_ROUNDS = 3;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: currentMessages,
        tools: TOOLS,
      });

      // If stop reason is "end_turn" or no tool use, extract text and return
      if (response.stop_reason === "end_turn" || !response.content.some((b) => b.type === "tool_use")) {
        const textBlock = response.content.find((b) => b.type === "text");
        const content = textBlock && "text" in textBlock
          ? textBlock.text
          : "I wasn't able to generate a response. Please try again.";
        return NextResponse.json({ content });
      }

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = executeTool(runId, block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Append assistant response + tool results to messages for next round
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    // If we exhausted rounds, return whatever text we have
    return NextResponse.json({
      content: "I ran into complexity processing that query. Could you try rephrasing or narrowing your question?",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Copilot API error:", message, stack);
    return NextResponse.json(
      { error: "Failed to generate response", detail: message },
      { status: 500 },
    );
  }
}
