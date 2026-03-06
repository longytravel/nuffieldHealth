import { NextResponse } from "next/server";
import { getBenchmarkProfiles, getLatestRun } from "@/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get("specialty") ?? undefined;

  const latestRun = await getLatestRun();
  if (!latestRun) {
    return NextResponse.json(
      { error: "No completed run found" },
      { status: 404 }
    );
  }

  const benchmarks = await getBenchmarkProfiles(latestRun.run_id, 5, specialty);

  const averageScore =
    benchmarks.length > 0
      ? Math.round(
          (benchmarks.reduce((sum, b) => sum + b.profile_completeness_score, 0) /
            benchmarks.length) *
            10
        ) / 10
      : null;

  return NextResponse.json({
    benchmarks,
    average_score: averageScore,
    run_id: latestRun.run_id,
    specialty: specialty ?? null,
  });
}
