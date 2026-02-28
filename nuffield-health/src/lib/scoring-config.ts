import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname } from "path";
import { SCORING_CONFIG_PATH } from "./config";
import {
  buildScoringConfig,
  type ScoringConfig,
  type BuildScoringConfigInput,
  toLegacyScoreWeights,
  toLegacyTierThresholds,
} from "./scoring-config-schema";

let cached: { mtimeMs: number; config: ScoringConfig } | null = null;

function ensureDirectoryExists(): void {
  mkdirSync(dirname(SCORING_CONFIG_PATH), { recursive: true });
}

function writeConfigFile(config: ScoringConfig): void {
  ensureDirectoryExists();
  writeFileSync(SCORING_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  const stats = statSync(SCORING_CONFIG_PATH);
  cached = { mtimeMs: stats.mtimeMs, config };
}

function parseConfigFile(raw: string): ScoringConfig {
  const parsed = JSON.parse(raw) as Partial<ScoringConfig>;
  return buildScoringConfig({
    version: typeof parsed.version === "number" ? parsed.version : 1,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    updatedBy: typeof parsed.updatedBy === "string" ? parsed.updatedBy : "system",
    weightsRaw: parsed.weightsRaw,
    tierThresholds: parsed.tierThresholds,
  });
}

function createDefaultConfig(): ScoringConfig {
  const config = buildScoringConfig({
    version: 1,
    updatedBy: "system-default",
  });
  writeConfigFile(config);
  return config;
}

export function readScoringConfig(): ScoringConfig {
  if (!existsSync(SCORING_CONFIG_PATH)) {
    return createDefaultConfig();
  }

  try {
    const stats = statSync(SCORING_CONFIG_PATH);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.config;
    }

    const raw = readFileSync(SCORING_CONFIG_PATH, "utf-8");
    const config = parseConfigFile(raw);
    cached = { mtimeMs: stats.mtimeMs, config };
    return config;
  } catch {
    return createDefaultConfig();
  }
}

export function saveScoringConfig(input: BuildScoringConfigInput): ScoringConfig {
  const current = readScoringConfig();
  const next = buildScoringConfig({
    version: current.version + 1,
    updatedBy: input.updatedBy ?? "user",
    weightsRaw: input.weightsRaw ?? current.weightsRaw,
    tierThresholds: input.tierThresholds ?? current.tierThresholds,
  });
  writeConfigFile(next);
  return next;
}

export function resetScoringConfig(updatedBy = "user"): ScoringConfig {
  const current = readScoringConfig();
  const reset = buildScoringConfig({
    version: current.version + 1,
    updatedBy,
  });
  writeConfigFile(reset);
  return reset;
}

export function getLegacyScoreConfig() {
  const active = readScoringConfig();
  return {
    active,
    weights: toLegacyScoreWeights(active),
    thresholds: toLegacyTierThresholds(active),
  };
}
