"use client";

import { useMemo, useState } from "react";
import { Info, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ScoringConfig,
  ScoringWeightKey,
  TierGateRule,
  TierThresholds,
} from "@/lib/scoring-config-schema";
import {
  SCORING_DIMENSION_DEFINITIONS,
  SCORING_WEIGHT_KEYS,
  getWeightsTotal,
  isTierThresholdOrderValid,
  normalizeWeights,
} from "@/lib/scoring-config-schema";

interface ConfigurationEditorProps {
  initialConfig: ScoringConfig;
}

const TIER_KEYS = ["gold", "silver", "bronze"] as const;
type TierKey = (typeof TIER_KEYS)[number];

const TIER_LABELS: Record<TierKey, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function ConfigurationEditor({ initialConfig }: ConfigurationEditorProps) {
  const [weightsRaw, setWeightsRaw] = useState(initialConfig.weightsRaw);
  const [tierThresholds, setTierThresholds] = useState(initialConfig.tierThresholds);
  const [gateRules, setGateRules] = useState(initialConfig.gateRules);
  const [updatedAt, setUpdatedAt] = useState(initialConfig.updatedAt);
  const [updatedBy, setUpdatedBy] = useState(initialConfig.updatedBy);
  const [version, setVersion] = useState(initialConfig.version);
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const effectiveWeights = useMemo(() => normalizeWeights(weightsRaw, 100), [weightsRaw]);
  const rawTotal = useMemo(() => getWeightsTotal(weightsRaw), [weightsRaw]);
  const effectiveTotal = useMemo(() => getWeightsTotal(effectiveWeights), [effectiveWeights]);
  const thresholdsValid = useMemo(() => isTierThresholdOrderValid(tierThresholds), [tierThresholds]);

  function setWeight(key: ScoringWeightKey, value: string): void {
    const numeric = Number(value);
    setWeightsRaw((prev) => ({
      ...prev,
      [key]: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0,
    }));
  }

  function setThreshold(key: keyof TierThresholds, value: string): void {
    const numeric = Number(value);
    setTierThresholds((prev) => ({
      ...prev,
      [key]: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0,
    }));
  }

  function setFailThreshold(value: string): void {
    const numeric = Number(value);
    setGateRules((prev) => ({
      ...prev,
      forceIncompleteOnFailCount: Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0,
    }));
  }

  function setBooleanGateRule(key: "blockGoldOnAnyFail" | "plainEnglishRequiresAdequateBio", checked: boolean): void {
    setGateRules((prev) => ({
      ...prev,
      [key]: checked,
    }));
  }

  function setTierGateRule(tier: TierKey, gateKey: keyof TierGateRule, checked: boolean): void {
    setGateRules((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [gateKey]: checked,
      },
    }));
  }

  async function saveConfiguration(): Promise<void> {
    setStatus({ type: "saving", message: "Saving configuration..." });
    try {
      const response = await fetch("/api/configuration/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          updatedBy: "ROG",
          weightsRaw,
          tierThresholds,
          gateRules,
        }),
      });
      const payload = (await response.json()) as ScoringConfig & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save configuration");
      }

      setWeightsRaw(payload.weightsRaw);
      setTierThresholds(payload.tierThresholds);
      setGateRules(payload.gateRules);
      setUpdatedAt(payload.updatedAt);
      setUpdatedBy(payload.updatedBy);
      setVersion(payload.version);
      setStatus({ type: "success", message: "Configuration saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save configuration";
      setStatus({ type: "error", message });
    }
  }

  async function resetToDefaults(): Promise<void> {
    setStatus({ type: "saving", message: "Resetting to defaults..." });
    try {
      const response = await fetch("/api/configuration/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          updatedBy: "ROG",
        }),
      });
      const payload = (await response.json()) as ScoringConfig & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to reset configuration");
      }

      setWeightsRaw(payload.weightsRaw);
      setTierThresholds(payload.tierThresholds);
      setGateRules(payload.gateRules);
      setUpdatedAt(payload.updatedAt);
      setUpdatedBy(payload.updatedBy);
      setVersion(payload.version);
      setStatus({ type: "success", message: "Defaults restored." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset configuration";
      setStatus({ type: "error", message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Version" value={`v${version}`} />
          <Stat label="Raw Weight Total" value={rawTotal.toFixed(2)} />
          <Stat label="Effective Total" value={effectiveTotal.toFixed(2)} />
          <Stat label="Last Updated" value={new Date(updatedAt).toLocaleString("en-GB")} />
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Updated by: {updatedBy}. Effective points are auto-normalized to 100.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Dimension
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Rule
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Raw Weight
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Effective Points
              </th>
            </tr>
          </thead>
          <tbody>
            {SCORING_DIMENSION_DEFINITIONS.map((dimension) => (
              <tr key={dimension.key} className="border-b border-[var(--border-subtle)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{dimension.label}</span>
                    <span title={dimension.description} className="inline-flex cursor-help text-[var(--text-muted)]">
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{dimension.scoringRule}</td>
                <td className="px-4 py-3">
                  <div className="ml-auto w-28">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={weightsRaw[dimension.key]}
                      onChange={(event) => setWeight(dimension.key, event.currentTarget.value)}
                      className="text-right font-mono"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                  {effectiveWeights[dimension.key].toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--bg-secondary)]">
              <td className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Totals
              </td>
              <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                Normalization keeps effective total stable.
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                {rawTotal.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                {effectiveTotal.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tier Thresholds</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ThresholdInput label="Gold" value={tierThresholds.gold} onChange={(v) => setThreshold("gold", v)} />
          <ThresholdInput label="Silver" value={tierThresholds.silver} onChange={(v) => setThreshold("silver", v)} />
          <ThresholdInput label="Bronze" value={tierThresholds.bronze} onChange={(v) => setThreshold("bronze", v)} />
        </div>
        {!thresholdsValid ? (
          <p className="mt-2 text-xs text-[var(--danger)]">
            Invalid order. Required: Gold &gt; Silver &gt; Bronze &gt;= 0.
          </p>
        ) : null}
      </div>

      <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tier Gates And Fail Rules</h3>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Force Incomplete On Fail Count</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={gateRules.forceIncompleteOnFailCount}
              onChange={(event) => setFailThreshold(event.currentTarget.value)}
              className="font-mono"
            />
            <span className="text-[11px] text-[var(--text-muted)]">Set to 0 to disable forced Incomplete on fail flags.</span>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--sensai-teal)]"
              checked={gateRules.blockGoldOnAnyFail}
              onChange={(event) => setBooleanGateRule("blockGoldOnAnyFail", event.currentTarget.checked)}
            />
            <span className="text-xs text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Block Gold on any fail flag</strong>
              <br />
              If enabled, one fail flag prevents Gold even when score and gates are met.
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--sensai-teal)]"
              checked={gateRules.plainEnglishRequiresAdequateBio}
              onChange={(event) => setBooleanGateRule("plainEnglishRequiresAdequateBio", event.currentTarget.checked)}
            />
            <span className="text-xs text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Plain English needs adequate bio</strong>
              <br />
              If enabled, thin or missing bio gets 0 plain-English points.
            </span>
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Tier
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Require Photo
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Require Substantive Bio
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Require Specialty Evidence
                </th>
              </tr>
            </thead>
            <tbody>
              {TIER_KEYS.map((tier) => (
                <tr key={tier} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{TIER_LABELS[tier]}</td>
                  <td className="px-4 py-2">
                    <GateToggle
                      checked={gateRules[tier].requirePhoto}
                      onCheckedChange={(checked) => setTierGateRule(tier, "requirePhoto", checked)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <GateToggle
                      checked={gateRules[tier].requireSubstantiveBio}
                      onCheckedChange={(checked) => setTierGateRule(tier, "requireSubstantiveBio", checked)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <GateToggle
                      checked={gateRules[tier].requireSpecialtyEvidence}
                      onCheckedChange={(checked) => setTierGateRule(tier, "requireSpecialtyEvidence", checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={saveConfiguration}
          disabled={status.type === "saving" || !thresholdsValid || SCORING_WEIGHT_KEYS.every((key) => weightsRaw[key] <= 0)}
          className="bg-[var(--sensai-teal)] text-[var(--bg-primary)] hover:bg-[var(--sensai-teal-dark)]"
        >
          <Save className="h-4 w-4" />
          Save Configuration
        </Button>
        <Button type="button" variant="outline" onClick={resetToDefaults} disabled={status.type === "saving"}>
          <RotateCcw className="h-4 w-4" />
          Reset Defaults
        </Button>
        <span
          className={`text-sm ${
            status.type === "error"
              ? "text-[var(--danger)]"
              : status.type === "success"
              ? "text-[var(--success)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          {status.message ?? "Adjust weights, thresholds, and gate rules, then save to activate for future scoring runs."}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="font-mono text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ThresholdInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="font-mono"
      />
    </label>
  );
}

function GateToggle({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--sensai-teal)]"
        checked={checked}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
      <span className="text-xs text-[var(--text-secondary)]">{checked ? "Required" : "Optional"}</span>
    </label>
  );
}
