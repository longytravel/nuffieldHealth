import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index";
import { consultants } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { run_id, slug } = body;

  if (!run_id || !slug) {
    return NextResponse.json(
      { error: "run_id and slug are required" },
      { status: 400 }
    );
  }

  db.update(consultants)
    .set({
      manually_reviewed: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "reviewer",
    })
    .where(and(eq(consultants.run_id, run_id), eq(consultants.slug, slug)))
    .run();

  return NextResponse.json({ success: true });
}
