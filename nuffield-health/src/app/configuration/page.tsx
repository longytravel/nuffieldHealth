import { Settings2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { PageTransition } from "@/components/ui/page-transition";
import { readScoringConfig } from "@/lib/scoring-config";
import type { TierGateRule } from "@/lib/scoring-config-schema";
import { ConfigurationEditor } from "./configuration-editor";

interface FlagDefinition {
  code: string;
  severity: "fail" | "warn" | "info";
  description: string;
}

const FLAG_DEFINITIONS: FlagDefinition[] = [
  { code: "PROFILE_NO_PHOTO", severity: "fail", description: "No profile photo found." },
  { code: "CONTENT_MISSING_BIO", severity: "fail", description: "Bio/About section missing." },
  { code: "CONTENT_NO_QUALIFICATIONS", severity: "fail", description: "No qualifications listed." },
  { code: "CONTENT_THIN_BIO", severity: "warn", description: "Bio is present but too short/sparse." },
  { code: "CONTENT_NO_TREATMENTS", severity: "warn", description: "No treatments listed (except waived non-procedural specialties)." },
  { code: "CONTENT_NO_INSURERS", severity: "warn", description: "No insurer list found." },
  { code: "BOOKING_NO_SLOTS", severity: "warn", description: "Bookable online but no slots in next 28 days." },
  { code: "QA_LOW_CONFIDENCE", severity: "warn", description: "Extractor confidence was low on one or more fields." },
  { code: "BOOKING_NOT_BOOKABLE", severity: "info", description: "Profile is not bookable online." },
  { code: "PROFILE_AGE_RESTRICTION", severity: "info", description: "Patient age restrictions are present." },
  { code: "PROFILE_SUBSTANTIVE_DECLARATION", severity: "info", description: "Declaration contains substantive financial interests." },
  { code: "PROFILE_NON_NUFFIELD_HOSPITAL", severity: "info", description: "Primary hospital is not a Nuffield facility." },
  { code: "CONTENT_CMS_CORRUPTION", severity: "warn", description: "CMS formatting corruption detected in content." },
];

function gateSummary(gates: TierGateRule): string {
  const parts: string[] = [];
  if (gates.requirePhoto) parts.push("photo");
  if (gates.requireSubstantiveBio) parts.push("substantive bio");
  if (gates.requireSpecialtyEvidence) parts.push("specialty evidence");
  return parts.length > 0 ? parts.join(", ") : "no mandatory gates";
}

export default function ConfigurationPage() {
  const config = readScoringConfig();
  const failThreshold = config.gateRules.forceIncompleteOnFailCount;
  const failThresholdText =
    failThreshold > 0
      ? `${failThreshold}+ fail-severity flag${failThreshold === 1 ? "" : "s"} are present`
      : "forced Incomplete by fail-count is disabled";

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-h1 text-[var(--text-primary)]">Configuration</h1>
        <p className="text-body text-[var(--text-secondary)]">
          Control score weights, tier thresholds, gates, and definitions.
        </p>
      </div>

      <GlassCard className="border-l-2 border-l-[var(--sensai-teal)]">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 text-[var(--sensai-teal)]" />
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <p>
              <strong className="text-[var(--text-primary)]">Incomplete tier:</strong> assigned when score is below Bronze threshold
              ({config.tierThresholds.bronze}), mandatory tier gates are not met, or {failThresholdText}.
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
            <li>
              <strong className="text-[var(--text-primary)]">Gold:</strong> score &gt;= {config.tierThresholds.gold}; gates: {gateSummary(config.gateRules.gold)};{" "}
              {config.gateRules.blockGoldOnAnyFail ? "any fail flag blocks Gold." : "fail flags do not automatically block Gold."}
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Silver:</strong> score &gt;= {config.tierThresholds.silver}; gates: {gateSummary(config.gateRules.silver)}.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Bronze:</strong> score &gt;= {config.tierThresholds.bronze}; gates: {gateSummary(config.gateRules.bronze)}.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Plain English gate:</strong>{" "}
              {config.gateRules.plainEnglishRequiresAdequateBio
                ? "plain-English points require bio depth of adequate/substantive."
                : "plain-English points can be awarded regardless of bio depth."}
            </li>
          </ul>
        </GlassCard>

        <GlassCard>
          <h2 className="text-h3 text-[var(--text-primary)]">Severity & Queue Rules</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">fail:</strong> critical issue used by tier-gate/fail-threshold logic.</li>
            <li><strong className="text-[var(--text-primary)]">warn:</strong> quality weakness, shown for review but does not force Incomplete by itself.</li>
            <li><strong className="text-[var(--text-primary)]">info:</strong> informational context only.</li>
            <li><strong className="text-[var(--text-primary)]">Review Queue inclusion:</strong> Incomplete tier, any fail flag, or QA low confidence.</li>
          </ul>
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-h3 text-[var(--text-primary)]">Flag Definitions</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Code</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Severity</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {FLAG_DEFINITIONS.map((flag) => (
                <tr key={flag.code} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--text-primary)]">{flag.code}</td>
                  <td className="px-3 py-2">
                    <span className="rounded px-2 py-0.5 text-xs capitalize bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                      {flag.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{flag.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Unknown code handling: if a new flag code appears that is not listed here, it will still display in profile/review views but should be added to this registry.
        </p>
      </GlassCard>
    </PageTransition>
  );
}
