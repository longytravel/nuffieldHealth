export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getLatestRun, getConsultant, getBenchmarkProfiles } from "@/db/queries";
import { PageTransition } from "@/components/ui/page-transition";
import { RewriteWorkspace } from "./rewrite-workspace";
import { Wand2 } from "lucide-react";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function str(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = params[key];
  return typeof v === "string" ? v : undefined;
}

export default async function RewritePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const slug = str(params, "slug");
  const element = str(params, "element") ?? null;
  const batchParam = str(params, "batch");
  const batchSlugs = batchParam ? batchParam.split(",").filter(Boolean) : [];

  const run = await getLatestRun();

  // Fetch consultant if slug provided
  let consultant = null;
  if (slug && run) {
    consultant = await getConsultant(run.run_id, slug);
  }

  // Fetch benchmarks (top 5 overall + top 5 in specialty if consultant loaded)
  const benchmarks = run ? await getBenchmarkProfiles(run.run_id, 5) : [];
  const primarySpecialty =
    consultant && consultant.specialty_primary.length > 0
      ? consultant.specialty_primary[0]
      : null;
  const specialtyBenchmarks =
    run && primarySpecialty
      ? await getBenchmarkProfiles(run.run_id, 5, primarySpecialty)
      : [];

  return (
    <PageTransition className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sensai-teal)]/15">
          <Wand2 className="h-5 w-5 text-[var(--sensai-teal)]" />
        </div>
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Profile Rewrite Engine</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            AI-powered profile improvements backed by web research
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="text-sm text-[var(--text-muted)]">Loading workspace...</div>}>
        <RewriteWorkspace
          runId={run?.run_id ?? ""}
          consultant={consultant}
          benchmarks={benchmarks}
          specialtyBenchmarks={specialtyBenchmarks}
          initialElement={element}
          batchSlugs={batchSlugs}
        />
      </Suspense>
    </PageTransition>
  );
}
