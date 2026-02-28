import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLatestRun, getQualityTierDistribution, getConsultantCount, getFlaggedConsultants } from "@/db/queries";
import { TierChart } from "./tier-chart";

const TIER_COLORS: Record<string, string> = {
  Gold: "#F59E0B",
  Silver: "#94A3B8",
  Bronze: "#D97706",
  Incomplete: "#EF4444",
};

export default async function OverviewPage() {
  const run = await getLatestRun();

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-2xl font-semibold">No Data Available</h1>
        <p className="text-muted-foreground">
          No completed scrape runs found. Run the scraper to populate data.
        </p>
        <code className="rounded bg-muted px-3 py-2 text-sm">
          npx tsx src/scraper/run.ts
        </code>
      </div>
    );
  }

  const [tierDistribution, totalCount, reviewCount] = await Promise.all([
    getQualityTierDistribution(run.run_id),
    getConsultantCount(run.run_id),
    getFlaggedConsultants(run.run_id).then((rows) => rows.length),
  ]);

  const bookableCount = tierDistribution.reduce((sum, t) => sum + t.count, 0);
  const avgScore = 0; // Placeholder — computed below from tier data

  const tierData = tierDistribution.map((t) => ({
    name: t.quality_tier ?? "Unknown",
    value: t.count,
    fill: TIER_COLORS[t.quality_tier ?? ""] ?? "#6B7280",
  }));

  const startedAt = run.started_at ? new Date(run.started_at) : null;
  const completedAt = run.completed_at ? new Date(run.completed_at) : null;
  const durationMs = startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : null;
  const durationStr = durationMs
    ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
    : "N/A";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Consultant profile quality dashboard
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              across all quality tiers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bookable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.success_count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              successfully scraped profiles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.error_count}</div>
            <p className="text-xs text-muted-foreground">
              profiles with errors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewCount}</div>
            <Link
              href="/consultants/review"
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              View review queue
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quality Tier Distribution + Latest Run */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quality Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {tierData.length > 0 ? (
              <TierChart data={tierData} />
            ) : (
              <p className="text-sm text-muted-foreground">No tier data available</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tier.fill }}
                  />
                  <span className="text-sm">
                    {tier.name}: {tier.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={run.status === "completed" ? "default" : "destructive"}
                >
                  {run.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">{durationStr}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Started</p>
                <p className="text-sm font-medium">
                  {startedAt ? startedAt.toLocaleString() : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Profiles</p>
                <p className="text-sm font-medium">{run.total_profiles.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success</p>
                <p className="text-sm font-medium text-green-600">{run.success_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-sm font-medium text-red-600">{run.error_count}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Link
                href="/consultants"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View Consultants
              </Link>
              <Link
                href="/consultants/review"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Review Queue
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
