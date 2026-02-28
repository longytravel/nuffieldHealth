export const SCORING_WEIGHT_KEYS = [
  "has_photo",
  "bio_depth",
  "treatments",
  "qualifications",
  "specialty",
  "insurers",
  "consultation_times",
  "plain_english",
  "booking",
  "practising_since",
  "memberships",
] as const;

export type ScoringWeightKey = (typeof SCORING_WEIGHT_KEYS)[number];

export type ScoringWeights = Record<ScoringWeightKey, number>;

export interface TierThresholds {
  gold: number;
  silver: number;
  bronze: number;
}

export interface TierGateRule {
  requirePhoto: boolean;
  requireSubstantiveBio: boolean;
  requireSpecialtyEvidence: boolean;
}

export interface PartialTierGateRule {
  requirePhoto?: unknown;
  requireSubstantiveBio?: unknown;
  requireSpecialtyEvidence?: unknown;
}

export interface GateRules {
  forceIncompleteOnFailCount: number;
  blockGoldOnAnyFail: boolean;
  plainEnglishRequiresAdequateBio: boolean;
  gold: TierGateRule;
  silver: TierGateRule;
  bronze: TierGateRule;
}

export interface PartialGateRules {
  forceIncompleteOnFailCount?: unknown;
  blockGoldOnAnyFail?: unknown;
  plainEnglishRequiresAdequateBio?: unknown;
  gold?: PartialTierGateRule;
  silver?: PartialTierGateRule;
  bronze?: PartialTierGateRule;
}

export interface ScoringConfig {
  version: number;
  updatedAt: string;
  updatedBy: string;
  normalization: {
    enabled: true;
    targetTotal: number;
  };
  weightsRaw: ScoringWeights;
  weightsEffective: ScoringWeights;
  tierThresholds: TierThresholds;
  gateRules: GateRules;
}

export interface ScoringDimensionDefinition {
  key: ScoringWeightKey;
  label: string;
  description: string;
  scoringRule: string;
}

export const SCORING_DIMENSION_DEFINITIONS: ScoringDimensionDefinition[] = [
  {
    key: "has_photo",
    label: "Profile Photo",
    description: "Photo present on consultant profile.",
    scoringRule: "Full points when photo exists; 0 when absent.",
  },
  {
    key: "bio_depth",
    label: "Biography Depth",
    description: "Depth/quality of About biography content.",
    scoringRule: "Substantive gets full points; Adequate gets 2/3.",
  },
  {
    key: "treatments",
    label: "Treatments Listed",
    description: "Named procedures/conditions/services on profile.",
    scoringRule: "Full points when treatments list is non-empty.",
  },
  {
    key: "qualifications",
    label: "Qualifications",
    description: "Professional credentials are present.",
    scoringRule: "Full points when qualifications text exists.",
  },
  {
    key: "specialty",
    label: "Specialty Evidence",
    description: "Specialty or sub-specialty data present.",
    scoringRule: "Full points when specialty evidence exists.",
  },
  {
    key: "insurers",
    label: "Insurers Listed",
    description: "Private insurers listed on profile page.",
    scoringRule: "Full points when insurers list is non-empty.",
  },
  {
    key: "consultation_times",
    label: "Consultation Times",
    description: "Published clinic/session times are available.",
    scoringRule: "Full points when consultation times exist.",
  },
  {
    key: "plain_english",
    label: "Plain English",
    description: "Patient readability quality score from AI.",
    scoringRule: "Score >=4 gets full points; score=3 gets 1/2.",
  },
  {
    key: "booking",
    label: "Booking Availability",
    description: "Online booking and slot availability.",
    scoringRule: "Bookable with slots gets full; no-slots gets 1/2.",
  },
  {
    key: "practising_since",
    label: "Practising Since",
    description: "Year of practising since is present.",
    scoringRule: "Full points when practising-since year exists.",
  },
  {
    key: "memberships",
    label: "Memberships",
    description: "Professional memberships are listed.",
    scoringRule: "Full points when memberships list is non-empty.",
  },
];

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  has_photo: 10,
  bio_depth: 15,
  treatments: 10,
  qualifications: 10,
  specialty: 10,
  insurers: 8,
  consultation_times: 7,
  plain_english: 10,
  booking: 10,
  practising_since: 5,
  memberships: 5,
};

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  gold: 80,
  silver: 60,
  bronze: 40,
};

export const DEFAULT_TIER_GATES: Record<"gold" | "silver" | "bronze", TierGateRule> = {
  gold: {
    requirePhoto: true,
    requireSubstantiveBio: true,
    requireSpecialtyEvidence: true,
  },
  silver: {
    requirePhoto: true,
    requireSubstantiveBio: false,
    requireSpecialtyEvidence: true,
  },
  bronze: {
    requirePhoto: false,
    requireSubstantiveBio: false,
    requireSpecialtyEvidence: true,
  },
};

export const DEFAULT_GATE_RULES: GateRules = {
  forceIncompleteOnFailCount: 2,
  blockGoldOnAnyFail: true,
  plainEnglishRequiresAdequateBio: true,
  gold: DEFAULT_TIER_GATES.gold,
  silver: DEFAULT_TIER_GATES.silver,
  bronze: DEFAULT_TIER_GATES.bronze,
};

export const LEGACY_BIO_ADEQUATE_MULTIPLIER = 2 / 3;
export const LEGACY_PLAIN_ENGLISH_MID_MULTIPLIER = 0.5;
export const LEGACY_BOOKING_NO_SLOTS_MULTIPLIER = 0.5;

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toFiniteNonNegative(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

function toFiniteNonNegativeInteger(value: unknown, fallback: number): number {
  return Math.round(toFiniteNonNegative(value, fallback));
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function coerceTierGateRule(value: PartialTierGateRule | undefined, fallback: TierGateRule): TierGateRule {
  return {
    requirePhoto: toBoolean(value?.requirePhoto, fallback.requirePhoto),
    requireSubstantiveBio: toBoolean(value?.requireSubstantiveBio, fallback.requireSubstantiveBio),
    requireSpecialtyEvidence: toBoolean(value?.requireSpecialtyEvidence, fallback.requireSpecialtyEvidence),
  };
}

export function coerceWeights(value: Partial<Record<ScoringWeightKey, unknown>> | undefined): ScoringWeights {
  const result = { ...DEFAULT_SCORING_WEIGHTS };
  if (!value) return result;

  for (const key of SCORING_WEIGHT_KEYS) {
    result[key] = toFiniteNonNegative(value[key], DEFAULT_SCORING_WEIGHTS[key]);
  }

  return result;
}

export function coerceTierThresholds(value: Partial<Record<keyof TierThresholds, unknown>> | undefined): TierThresholds {
  if (!value) return { ...DEFAULT_TIER_THRESHOLDS };
  return {
    gold: toFiniteNonNegative(value.gold, DEFAULT_TIER_THRESHOLDS.gold),
    silver: toFiniteNonNegative(value.silver, DEFAULT_TIER_THRESHOLDS.silver),
    bronze: toFiniteNonNegative(value.bronze, DEFAULT_TIER_THRESHOLDS.bronze),
  };
}

export function coerceGateRules(value: PartialGateRules | undefined): GateRules {
  return {
    forceIncompleteOnFailCount: toFiniteNonNegativeInteger(
      value?.forceIncompleteOnFailCount,
      DEFAULT_GATE_RULES.forceIncompleteOnFailCount
    ),
    blockGoldOnAnyFail: toBoolean(value?.blockGoldOnAnyFail, DEFAULT_GATE_RULES.blockGoldOnAnyFail),
    plainEnglishRequiresAdequateBio: toBoolean(
      value?.plainEnglishRequiresAdequateBio,
      DEFAULT_GATE_RULES.plainEnglishRequiresAdequateBio
    ),
    gold: coerceTierGateRule(value?.gold, DEFAULT_GATE_RULES.gold),
    silver: coerceTierGateRule(value?.silver, DEFAULT_GATE_RULES.silver),
    bronze: coerceTierGateRule(value?.bronze, DEFAULT_GATE_RULES.bronze),
  };
}

export function isTierThresholdOrderValid(value: TierThresholds): boolean {
  return value.gold > value.silver && value.silver > value.bronze && value.bronze >= 0;
}

export function normalizeWeights(weightsRaw: ScoringWeights, targetTotal = 100): ScoringWeights {
  const rawValues = SCORING_WEIGHT_KEYS.map((key) => toFiniteNonNegative(weightsRaw[key], 0));
  const sum = rawValues.reduce((acc, n) => acc + n, 0);

  if (sum <= 0) {
    return { ...DEFAULT_SCORING_WEIGHTS };
  }

  const normalized: Partial<ScoringWeights> = {};
  let allocated = 0;

  for (let i = 0; i < SCORING_WEIGHT_KEYS.length; i++) {
    const key = SCORING_WEIGHT_KEYS[i];
    if (i === SCORING_WEIGHT_KEYS.length - 1) {
      normalized[key] = round(targetTotal - allocated);
      continue;
    }
    const value = round((weightsRaw[key] / sum) * targetTotal);
    normalized[key] = value;
    allocated += value;
  }

  return normalized as ScoringWeights;
}

export function getWeightsTotal(weights: ScoringWeights): number {
  return round(
    SCORING_WEIGHT_KEYS.reduce((acc, key) => acc + toFiniteNonNegative(weights[key], 0), 0)
  );
}

export interface BuildScoringConfigInput {
  weightsRaw?: Partial<Record<ScoringWeightKey, unknown>>;
  tierThresholds?: Partial<Record<keyof TierThresholds, unknown>>;
  gateRules?: PartialGateRules;
  updatedBy?: string;
  version?: number;
  updatedAt?: string;
}

export function buildScoringConfig(input?: BuildScoringConfigInput): ScoringConfig {
  const weightsRaw = coerceWeights(input?.weightsRaw);
  return {
    version: input?.version ?? 1,
    updatedAt: input?.updatedAt ?? new Date().toISOString(),
    updatedBy: input?.updatedBy ?? "system",
    normalization: {
      enabled: true,
      targetTotal: 100,
    },
    weightsRaw,
    weightsEffective: normalizeWeights(weightsRaw, 100),
    tierThresholds: coerceTierThresholds(input?.tierThresholds),
    gateRules: coerceGateRules(input?.gateRules),
  };
}

export interface LegacyScoreWeights {
  has_photo: number;
  bio_depth_substantive: number;
  bio_depth_adequate: number;
  treatments_non_empty: number;
  qualifications_non_null: number;
  specialty_primary_non_empty: number;
  insurers_non_empty: number;
  consultation_times_non_empty: number;
  plain_english_4_plus: number;
  plain_english_3: number;
  booking_with_slots: number;
  booking_no_slots: number;
  practising_since_non_null: number;
  memberships_non_empty: number;
}

export interface LegacyTierThresholds {
  gold: { minScore: number; mandatory: string[] };
  silver: { minScore: number; mandatory: string[] };
  bronze: { minScore: number; mandatory: string[] };
  incomplete: { minScore: number; mandatory: string[] };
}

function toLegacyMandatoryGates(gateRule: TierGateRule): string[] {
  const gates: string[] = [];
  if (gateRule.requirePhoto) gates.push("has_photo");
  if (gateRule.requireSubstantiveBio) gates.push("bio_depth_substantive");
  if (gateRule.requireSpecialtyEvidence) gates.push("specialty_non_empty");
  return gates;
}

export function toLegacyScoreWeights(config: ScoringConfig): LegacyScoreWeights {
  const w = config.weightsEffective;
  return {
    has_photo: w.has_photo,
    bio_depth_substantive: w.bio_depth,
    bio_depth_adequate: round(w.bio_depth * LEGACY_BIO_ADEQUATE_MULTIPLIER),
    treatments_non_empty: w.treatments,
    qualifications_non_null: w.qualifications,
    specialty_primary_non_empty: w.specialty,
    insurers_non_empty: w.insurers,
    consultation_times_non_empty: w.consultation_times,
    plain_english_4_plus: w.plain_english,
    plain_english_3: round(w.plain_english * LEGACY_PLAIN_ENGLISH_MID_MULTIPLIER),
    booking_with_slots: w.booking,
    booking_no_slots: round(w.booking * LEGACY_BOOKING_NO_SLOTS_MULTIPLIER),
    practising_since_non_null: w.practising_since,
    memberships_non_empty: w.memberships,
  };
}

export function toLegacyTierThresholds(config: ScoringConfig): LegacyTierThresholds {
  return {
    gold: {
      minScore: config.tierThresholds.gold,
      mandatory: toLegacyMandatoryGates(config.gateRules.gold),
    },
    silver: {
      minScore: config.tierThresholds.silver,
      mandatory: toLegacyMandatoryGates(config.gateRules.silver),
    },
    bronze: {
      minScore: config.tierThresholds.bronze,
      mandatory: toLegacyMandatoryGates(config.gateRules.bronze),
    },
    incomplete: {
      minScore: 0,
      mandatory: [],
    },
  };
}
