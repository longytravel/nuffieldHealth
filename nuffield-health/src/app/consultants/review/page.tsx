import { getLatestRun, getFlaggedConsultants } from "@/db/queries";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ReviewActions } from "./review-actions";

const SEVERITY_STYLES: Record<string, string> = {
  fail: "bg-red-100 text-red-800",
  warn: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-800",
};

export default async function ReviewQueuePage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Queue</h1>
        <p className="text-muted-foreground">
          {flaggedConsultants.length} profiles need review
        </p>
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
        <div className="rounded-md border">
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
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.flags.map((flag, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className={`text-xs ${SEVERITY_STYLES[flag.severity] ?? ""}`}
                        >
                          {flag.code}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
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
    </div>
  );
}
