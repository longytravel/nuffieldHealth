import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { insertRewrite } from "@/db/queries";
import { runResearchPipeline } from "@/lib/research-pipeline";
import type { RewritableElementKey } from "@/lib/types";

const REWRITABLE_ELEMENT_KEYS: RewritableElementKey[] = [
  "bio",
  "treatments",
  "qualifications",
  "specialty_sub",
  "memberships",
  "practising_since",
  "clinical_interests",
  "personal_interests",
  "photo",
];

const requestSchema = z.object({
  slug: z.string().min(1),
  run_id: z.string().min(1),
  elements: z.array(z.enum(REWRITABLE_ELEMENT_KEYS as [RewritableElementKey, ...RewritableElementKey[]])).optional(),
  mode: z.enum(["full", "element"]).default("full"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { slug, run_id, elements, mode } = parsed.data;
  const rewrite_id = randomUUID();
  const now = new Date().toISOString();

  // Create the rewrite record with status "draft"
  insertRewrite({
    rewrite_id,
    run_id,
    slug,
    rewrite_mode: mode,
    element_key: null,
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

  // Fire-and-forget — do not await
  void runResearchPipeline({ slug, run_id, rewrite_id, elements, mode });

  return NextResponse.json({ rewrite_id, status: "queued" }, { status: 201 });
}
