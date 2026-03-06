import { NextResponse } from "next/server";
import { getBatch } from "@/lib/batch-store";
import { getRewrite } from "@/db/queries";

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { batchId } = await params;

  const batch = getBatch(batchId);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // Build per-rewrite status
  const items = await Promise.all(
    batch.rewrite_ids.map(async (rewrite_id, i) => {
      const slug = batch.slugs[i];
      const isCompleted = batch.completed.has(rewrite_id);
      const isFailed = batch.failed.has(rewrite_id);

      let status: "pending" | "in_progress" | "complete" | "failed";
      if (isFailed) {
        status = "failed";
      } else if (isCompleted) {
        status = "complete";
      } else {
        // Check the actual rewrite record to determine in_progress vs pending
        const rewrite = await getRewrite(rewrite_id);
        if (rewrite && rewrite.rewritten_content !== null) {
          status = "complete";
        } else {
          status = "pending";
        }
      }

      return { slug, rewrite_id, status };
    })
  );

  const completed = items.filter((i) => i.status === "complete").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const total = batch.slugs.length;

  return NextResponse.json({
    batch_id: batchId,
    total,
    completed,
    failed,
    pending,
    run_id: batch.run_id,
    mode: batch.mode,
    created_at: batch.created_at,
    items,
  });
}
