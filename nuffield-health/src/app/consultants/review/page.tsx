import { getLatestRun, getFlaggedConsultants } from "@/db/queries";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PageTransition } from "@/components/ui/page-transition";
import { ReviewActions } from "./review-actions";
import { ResetReviewMarksButton } from "./reset-review-marks-button";
import { readScoringConfig } from "@/lib/scoring-config";

const SEVERITY_STYLES: Record<string, string> = {
  fail: "bg-red-100 text-red-800",
  warn: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-800",
};

export default async function ReviewQueuePage() {
  const scoringConfig = readScoringConfig();
  const run = await getLatestRun();

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-2xl font-semibold">No Data Available</h1>
        <p className="text-muted-foreground">
          No completed scrape runs found. Run the scraper to populate data.
        </p>
      </div>
    );
  }

  const flaggedConsultants = await getFlaggedConsultants(run.run_id);

  function getQueueReasons(c: (typeof flaggedConsultants)[number]): string[] {
    const reasons: string[] = [];
    const hasFail = c.flags.some((flag) => flag.severity === "fail");
    const hasLowConfidence = c.flags.some((flag) => flag.code === "QA_LOW_CONFIDENCE");

    if (c.quality_tier === "Incomplete") {
      reasons.push("Incomplete tier");
    }
    if (hasFail) {
      reasons.push("Fail-severity flag");
    }
    if (hasLowConfidence) {
      reasons.push("Low-confidence extraction");
    }

    return reasons;
  }

  function getTierTooltip(c: (typeof flaggedConsultants)[number]): string {
    if (c.quality_tier === "Incomplete") {
      const failThreshold = scoringConfig.gateRules.forceIncompleteOnFailCount;
      const failRuleText =
        failThreshold > 0
          ? `${failThreshold}+ fail flags trigger Incomplete`
          : "fail-count forced Incomplete is disabled";
      return `Incomplete means score < ${scoringConfig.tierThresholds.bronze}, or mandatory tier gates are not met, or ${failRuleText}.`;
    }
    return "Tier is based on score plus mandatory field gates.";
  }

  return (
    <PageTransition className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Review Queue</h1>
            <p className="text-muted-foreground">
              {flaggedConsultants.length} profiles need review
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes profiles that are Incomplete, have fail-severity flags, or
              contain low-confidence extractions.
            </p>
          </div>
          <ResetReviewMarksButton runId={run.run_id} />
        </div>
      </div>

      {flaggedConsultants.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16">
          <p className="text-lg font-medium">All clear</p>
          <p className="text-sm text-muted-foreground">
            No profiles currently need review
          </p>
          <Link
            href="/consultants"
            className="text-sm text-primary underline hover:no-underline"
          >
            View all consultants
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Flags
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Tier / Score
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {flaggedConsultants.map((c) => (
                <tr key={c.slug} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/consultants/${c.slug}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {c.consultant_name ?? c.slug}
                    </Link>
                    {c.hospital_name_primary && (
                      <p className="text-xs text-muted-foreground">
                        {c.hospital_name_primary}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {getQueueReasons(c).map((reason) => (
                        <Badge
                          key={reason}
                          variant="secondary"
                          className="text-[10px]"
                          title={`Queue reason: ${reason}`}
                        >
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.flags.map((flag, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className={`text-xs ${SEVERITY_STYLES[flag.severity] ?? ""}`}
                          title={`${flag.code}: ${flag.message}`}
                        >
                          {flag.code}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" title={getTierTooltip(c)}>
                    {c.quality_tier ?? "-"} /{" "}
                    {c.profile_completeness_score != null
                      ? Math.round(c.profile_completeness_score)
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReviewActions runId={run.run_id} slug={c.slug} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
