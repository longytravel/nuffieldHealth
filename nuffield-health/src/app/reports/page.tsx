import {
  FileText,
  GitCompareArrows,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { PageTransition } from "@/components/ui/page-transition";
import {
  getLatestRun,
  getRunHistory,
  getDashboardKPIs,
  getQualityTierDistribution,
  getQuickActions,
  getHospitalLeaderboard,
  getSpecialtyAnalysis,
  getImpactSummary,
  getTopPerformers,
  getAtRiskProfiles,
} from "@/db/queries";
import { PdfPreview } from "./components/pdf-preview";
import { CsvExportBuilder } from "./components/csv-export-builder";
import { ReportTabs } from "./components/report-tabs";
import { generateAiExecutiveReport } from "./ai-report";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "In progress...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default async function ReportsPage() {
  const latestRun = await getLatestRun();

  if (!latestRun) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <GlassCard className="max-w-md text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--sensai-teal)]/15">
              <FileText className="h-8 w-8 text-[var(--sensai-teal)]" />
            </div>
            <h1 className="text-h1 text-[var(--text-primary)]">Reports</h1>
            <p className="text-body text-[var(--text-secondary)]">
              No completed runs found. Run the scraper pipeline first to generate report data.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  const [
    kpis,
    tierDistribution,
    runs,
    quickActions,
    hospitalLeaderboard,
    specialtyAnalysis,
    impactSummary,
    topPerformers,
    atRiskProfiles,
  ] = await Promise.all([
    getDashboardKPIs(latestRun.run_id),
    getQualityTierDistribution(latestRun.run_id),
    getRunHistory(),
    getQuickActions(latestRun.run_id),
    getHospitalLeaderboard(latestRun.run_id),
    getSpecialtyAnalysis(latestRun.run_id),
    getImpactSummary(latestRun.run_id),
    getTopPerformers(latestRun.run_id, 5),
    getAtRiskProfiles(latestRun.run_id, 8),
  ]);

  const tierMap: Record<string, number> = {};
  for (const row of tierDistribution) {
    if (row.quality_tier) tierMap[row.quality_tier] = row.count;
  }

  const aiReport = await generateAiExecutiveReport({
    runId: latestRun.run_id,
    runDate: latestRun.started_at,
    kpis,
    tierCounts: {
      Gold: tierMap["Gold"] ?? 0,
      Silver: tierMap["Silver"] ?? 0,
      Bronze: tierMap["Bronze"] ?? 0,
      Incomplete: tierMap["Incomplete"] ?? 0,
    },
    quickActions: quickActions.slice(0, 5),
    impactSummary,
    topHospitals: hospitalLeaderboard.slice(0, 5),
    topSpecialties: specialtyAnalysis.slice(0, 6).map((s) => ({
      specialty: s.specialty,
      consultantCount: s.consultantCount,
      avgScore: s.avgScore,
      goldCount: s.goldCount,
      silverCount: s.silverCount,
      bronzeCount: s.bronzeCount,
      incompleteCount: s.incompleteCount,
      photoPct: s.photoPct,
      bookablePct: s.bookablePct,
    })),
    topPerformers: topPerformers.map((p) => ({
      consultantName: p.consultantName,
      hospitalName: p.hospitalName,
      score: p.score,
      qualityTier: p.qualityTier,
    })),
    atRiskProfiles: atRiskProfiles.map((p) => ({
      consultantName: p.consultantName,
      hospitalName: p.hospitalName,
      score: p.score,
      qualityTier: p.qualityTier,
      hasPhoto: p.hasPhoto,
      bioDepth: p.bioDepth,
      insurerCount: p.insurerCount,
    })),
  });

  return (
    <PageTransition className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">Reports</h1>
        <p className="mt-1 text-body text-[var(--text-secondary)]">
          Generate executive reports, export data, and review pipeline run history.
        </p>
      </div>

      {/* Tabbed content */}
      <ReportTabs
        pdfPreview={
          <PdfPreview
            runId={latestRun.run_id}
            runDate={formatDate(latestRun.started_at)}
            totalProfiles={kpis.totalProfiles}
            avgScore={kpis.avgScore}
            goldCount={tierMap["Gold"] ?? 0}
            silverCount={tierMap["Silver"] ?? 0}
            bronzeCount={tierMap["Bronze"] ?? 0}
            incompleteCount={tierMap["Incomplete"] ?? 0}
            quickActions={quickActions}
            hospitalLeaderboard={hospitalLeaderboard.slice(0, 5)}
            specialties={specialtyAnalysis.slice(0, 6)}
            impactSummary={impactSummary}
            topPerformers={topPerformers}
            atRiskProfiles={atRiskProfiles}
            aiReport={aiReport}
          />
        }
        csvExport={<CsvExportBuilder />}
        runHistory={
          <RunHistoryTable
            runs={runs}
            latestRunId={latestRun.run_id}
          />
        }
      />
    </PageTransition>
  );
}

/* ------------------------------------------------------------------ */
/*  Run History Table (server component)                               */
/* ------------------------------------------------------------------ */

interface RunRow {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  total_profiles: number;
  success_count: number;
  error_count: number;
}

function RunHistoryTable({
  runs,
  latestRunId,
}: {
  runs: RunRow[];
  latestRunId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 text-[var(--text-primary)]">Pipeline Run History</h2>
          <p className="text-caption text-[var(--text-muted)]">
            {runs.length} total run{runs.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
          <GitCompareArrows className="h-3.5 w-3.5 text-[var(--sensai-teal)]" />
          Snapshot comparison coming soon
        </div>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Run ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Duration
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Profiles
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Success
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Errors
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {runs.map((run) => (
                <tr
                  key={run.run_id}
                  className="transition-colors hover:bg-[var(--bg-elevated)]/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-[var(--text-secondary)]">
                        {run.run_id.slice(0, 8)}
                      </code>
                      {run.run_id === latestRunId && (
                        <span className="rounded-full bg-[var(--sensai-teal)]/15 px-1.5 py-0.5 text-[9px] font-medium text-[var(--sensai-teal)]">
                          Latest
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {formatDate(run.started_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {formatDuration(run.started_at, run.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--text-primary)]">
                    {run.total_profiles}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">
                    {run.success_count}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--danger)]">
                    {run.error_count || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--info)]">
          <Clock className="h-3 w-3" />
          Running
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="text-[10px] text-[var(--text-muted)]">{status}</span>
      );
  }
}
