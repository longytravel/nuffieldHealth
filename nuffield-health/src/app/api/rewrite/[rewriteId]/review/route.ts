import { NextResponse } from "next/server";
import { z } from "zod";
import { getRewritesForConsultant, getRewrite, updateRewriteStatus } from "@/db/queries";

const requestSchema = z.object({
  action: z.enum(["accept", "reject"]),
  elements: z.array(z.string()).min(1),
  reason: z.string().optional(),
  reviewed_by: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ rewriteId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { rewriteId } = await params;

  // Verify the parent rewrite record exists
  const rewrite = await getRewrite(rewriteId);
  if (!rewrite) {
    return NextResponse.json({ error: "Rewrite not found" }, { status: 404 });
  }

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

  const { action, elements, reviewed_by } = parsed.data;
  const status = action === "accept" ? "accepted" : "rejected";

  // Get all rewrites for this consultant+run to find element-specific records
  const allRewrites = await getRewritesForConsultant(rewrite.slug, rewrite.run_id);

  const updatedIds: string[] = [];

  for (const elementKey of elements) {
    // Find the matching element rewrite record
    const match = allRewrites.find((r) => r.element_key === elementKey);
    const targetId = match ? match.rewrite_id : rewriteId;

    updateRewriteStatus(targetId, status, reviewed_by ?? undefined);
    updatedIds.push(targetId);
  }

  return NextResponse.json({
    updated: updatedIds.length,
    rewrite_ids: updatedIds,
    status,
  });
}
