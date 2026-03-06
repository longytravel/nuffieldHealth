import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index";
import { consultants } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { run_id, slug, action } = body as {
    run_id?: string;
    slug?: string;
    action?: "mark_reviewed" | "reset_run" | "reset_profile";
  };

  if (!run_id) {
    return NextResponse.json(
      { error: "run_id is required" },
      { status: 400 }
    );
  }

  if (action === "reset_run") {
    const result = await db.update(consultants)
      .set({
        manually_reviewed: false,
        reviewed_at: null,
        reviewed_by: null,
      })
      .where(eq(consultants.run_id, run_id))
      .run();

    const resetCount = (result as { changes?: number; rowsAffected?: number }).changes ?? (result as { rowsAffected?: number }).rowsAffected ?? 0;
    return NextResponse.json({ success: true, resetCount });
  }

  if (action === "reset_profile") {
    if (!slug) {
      return NextResponse.json(
        { error: "slug is required for reset_profile" },
        { status: 400 }
      );
    }
    const result = await db.update(consultants)
      .set({
        manually_reviewed: false,
        reviewed_at: null,
        reviewed_by: null,
      })
      .where(and(eq(consultants.run_id, run_id), eq(consultants.slug, slug)))
      .run();
    const resetCount2 = (result as { changes?: number; rowsAffected?: number }).changes ?? (result as { rowsAffected?: number }).rowsAffected ?? 0;
    return NextResponse.json({ success: true, resetCount: resetCount2 });
  }

  if (!slug) {
    return NextResponse.json(
      { error: "slug is required" },
      { status: 400 }
    );
  }

  await db.update(consultants)
    .set({
      manually_reviewed: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "reviewer",
    })
    .where(and(eq(consultants.run_id, run_id), eq(consultants.slug, slug)))
    .run();

  return NextResponse.json({ success: true });
}
