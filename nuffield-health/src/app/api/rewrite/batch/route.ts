import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { insertRewrite } from "@/db/queries";
import { runResearchPipeline } from "@/lib/research-pipeline";
import { setBatch, markBatchRewriteCompleted, markBatchRewriteFailed } from "@/lib/batch-store";

const requestSchema = z.object({
  slugs: z.array(z.string().min(1)).min(1),
  run_id: z.string().min(1),
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

  const { slugs, run_id, mode } = parsed.data;
  const batch_id = randomUUID();
  const now = new Date().toISOString();

  // Create rewrite records for each slug
  const rewrite_ids: string[] = [];
  for (const slug of slugs) {
    const rewrite_id = randomUUID();
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
    rewrite_ids.push(rewrite_id);
  }

  // Store batch metadata
  setBatch(batch_id, {
    slugs,
    rewrite_ids,
    run_id,
    mode,
    completed: new Set(),
    failed: new Set(),
    created_at: now,
  });

  // Process sequentially in the background (fire-and-forget)
  void (async () => {
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const rewrite_id = rewrite_ids[i];
      try {
        await runResearchPipeline({ slug, run_id, rewrite_id, mode });
        markBatchRewriteCompleted(batch_id, rewrite_id);
      } catch (err) {
        console.error(`[batch ${batch_id}] failed for slug=${slug}:`, err);
        markBatchRewriteFailed(batch_id, rewrite_id);
      }
    }
  })();

  return NextResponse.json(
    { batch_id, queued: slugs.length, rewrite_ids },
    { status: 201 }
  );
}
