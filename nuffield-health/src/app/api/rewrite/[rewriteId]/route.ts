import { NextResponse } from "next/server";
import { getRewrite, getResearchSourcesForRewrite } from "@/db/queries";
import { getSearchErrors } from "@/lib/research-pipeline";
import type { RewriteResponse, ElementRewriteResult, RewritableElementKey } from "@/lib/types";

interface RouteParams {
  params: Promise<{ rewriteId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { rewriteId } = await params;

  const rewrite = await getRewrite(rewriteId);
  if (!rewrite) {
    return NextResponse.json({ error: "Rewrite not found" }, { status: 404 });
  }

  const sources = await getResearchSourcesForRewrite(rewriteId);

  // Build per-element results. The rewrite record may represent a single element
  // (element_key set) or a full-profile session (element_key null).
  const elements: Partial<Record<RewritableElementKey, ElementRewriteResult>> = {};

  const allElementSources = sources.map((s) => ({
    source_id: s.source_id,
    url: s.result_url,
    title: s.result_title,
    corroborated: s.corroborated === 1,
  }));

  if (rewrite.element_key) {
    // Single-element rewrite
    const key = rewrite.element_key as RewritableElementKey;
    elements[key] = {
      status: rewrite.rewritten_content !== null ? "complete" : "searching",
      rewritten_content: rewrite.rewritten_content,
      original_content: rewrite.original_content,
      sources: allElementSources,
      projected_delta: rewrite.projected_score_delta,
      seo_score_before: rewrite.seo_score_before,
      seo_score_after: rewrite.seo_score_after,
    };
  } else if (rewrite.rewritten_content) {
    // Full-profile rewrite — content is JSON keyed by element
    try {
      const contentByElement = JSON.parse(rewrite.rewritten_content) as Record<string, string | null>;
      const originalByElement = rewrite.original_content
        ? (JSON.parse(rewrite.original_content) as Record<string, string | null>)
        : {};

      for (const [key, content] of Object.entries(contentByElement)) {
        elements[key as RewritableElementKey] = {
          status: "complete",
          rewritten_content: content,
          original_content: originalByElement[key] ?? null,
          sources: allElementSources,
          projected_delta: rewrite.projected_score_delta,
          seo_score_before: rewrite.seo_score_before,
          seo_score_after: rewrite.seo_score_after,
        };
      }
    } catch {
      // If content isn't valid JSON, treat as incomplete
    }
  }

  const response: RewriteResponse = {
    rewrite_id: rewrite.rewrite_id,
    status: rewrite.rewritten_content !== null ? "complete" : "searching",
    progress: {
      current_stage: rewrite.rewritten_content !== null ? "complete" : "searching",
      sources_found: sources.length,
      facts_extracted: sources.reduce((sum, s) => {
        const facts = s.extracted_facts;
        return sum + (Array.isArray(facts) ? facts.length : 0);
      }, 0),
      search_errors: getSearchErrors(rewriteId),
    },
    elements,
    projected_total_score: rewrite.projected_total_score,
    projected_tier: rewrite.projected_tier,
  };

  return NextResponse.json(response);
}
