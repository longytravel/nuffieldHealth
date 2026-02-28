import { Settings2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { PageTransition } from "@/components/ui/page-transition";
import { readScoringConfig } from "@/lib/scoring-config";
import { ConfigurationEditor } from "./configuration-editor";

export default function ConfigurationPage() {
  const config = readScoringConfig();

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">Configuration</h1>
        <p className="text-body text-[var(--text-secondary)]">
          Control score weights, tier thresholds, and scoring definitions.
        </p>
      </div>

      <GlassCard className="border-l-2 border-l-[var(--sensai-teal)]">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 text-[var(--sensai-teal)]" />
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <p>
              <strong className="text-[var(--text-primary)]">Incomplete tier:</strong> assigned when score is below Bronze threshold,
              mandatory tier gates are not met, or 2+ fail-severity flags are present.
            </p>
            <p>
              Weight changes are normalized to an effective 100-point scale. This keeps tiers comparable across runs.
            </p>
          </div>
        </div>
      </GlassCard>

      <ConfigurationEditor initialConfig={config} />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h2 className="text-h3 text-[var(--text-primary)]">Tier Definitions</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">Gold:</strong> score &gt;= Gold threshold, has photo, substantive bio, specialty evidence, no fail flags.</li>
            <li><strong className="text-[var(--text-primary)]">Silver:</strong> score &gt;= Silver threshold, has photo, specialty evidence.</li>
            <li><strong className="text-[var(--text-primary)]">Bronze:</strong> score &gt;= Bronze threshold, specialty evidence.</li>
            <li><strong className="text-[var(--text-primary)]">Incomplete:</strong> below Bronze threshold, missing mandatory gate, or 2+ fail flags.</li>
          </ul>
        </GlassCard>

        <GlassCard>
          <h2 className="text-h3 text-[var(--text-primary)]">Flag & Queue Definitions</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">fail:</strong> mandatory quality issue; blocks Gold and can force Incomplete.</li>
            <li><strong className="text-[var(--text-primary)]">warn:</strong> quality weakness; reduces score but does not block tier alone.</li>
            <li><strong className="text-[var(--text-primary)]">info:</strong> informational observation only.</li>
            <li><strong className="text-[var(--text-primary)]">Review Queue inclusion:</strong> Incomplete tier, any fail flag, or QA low confidence.</li>
          </ul>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
