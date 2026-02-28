import {
  SCORE_WEIGHTS,
  TIER_THRESHOLDS,
  NON_PROCEDURAL_SPECIALTIES,
} from "@/lib/config";
import type { Flag, FlagSeverity, QualityTier, BioDepth, BookingState } from "@/lib/types";

export interface ScoreInput {
  has_photo: boolean | null;
  bio_depth: BioDepth | null;
  treatments: string[];
  qualifications_credentials: string | null;
  specialty_primary: string[];
  insurers: string[];
  consultation_times_raw: string[];
  plain_english_score: number | null;
  booking_state: BookingState | null;
  online_bookable: boolean | null;
  practising_since: number | null;
  memberships: string[];
  available_slots_next_28_days: number | null;
  gmc_code_for_booking: string | null;
}

export interface ScoreResult {
  profile_completeness_score: number;
  quality_tier: QualityTier;
  flags: Flag[];
}

function addFlag(flags: Flag[], code: string, severity: FlagSeverity, message: string): void {
  flags.push({ code, severity, message });
}

/**
 * Check if a specialty list intersects with the non-procedural specialties list.
 */
function isNonProcedural(specialties: string[]): boolean {
  const nonProcSet = new Set(
    (NON_PROCEDURAL_SPECIALTIES as readonly string[]).map((s) => s.toLowerCase())
  );
  return specialties.some((s) => nonProcSet.has(s.toLowerCase()));
}

/**
 * Deterministic scoring function implementing the exact formula from quick-spec section 3.4.
 * Calculates profile_completeness_score, quality_tier, and flags.
 */
export function scoreConsultant(data: ScoreInput): ScoreResult {
  let score = 0;
  const flags: Flag[] = [];

  const specialtyWaiver = isNonProcedural(data.specialty_primary);

  // --- Score calculation ---

  // has_photo: 10 points
  if (data.has_photo === true) {
    score += SCORE_WEIGHTS.has_photo;
  } else {
    addFlag(flags, "PROFILE_NO_PHOTO", "fail", "Profile has no photo");
  }

  // bio_depth: 15 for substantive, 10 for adequate, 0 otherwise
  if (data.bio_depth === "substantive") {
    score += SCORE_WEIGHTS.bio_depth_substantive;
  } else if (data.bio_depth === "adequate") {
    score += SCORE_WEIGHTS.bio_depth_adequate;
  } else if (data.bio_depth === "missing" || data.bio_depth === null) {
    addFlag(flags, "CONTENT_MISSING_BIO", "fail", "Profile has no bio/about section");
  } else if (data.bio_depth === "thin") {
    addFlag(flags, "CONTENT_THIN_BIO", "warn", "Profile bio is thin/sparse");
  }

  // treatments non-empty: 10 points (waived for non-procedural specialties)
  if (data.treatments.length > 0) {
    score += SCORE_WEIGHTS.treatments_non_empty;
  } else if (!specialtyWaiver) {
    addFlag(flags, "CONTENT_NO_TREATMENTS", "warn", "No treatments listed");
  }

  // qualifications: 10 points
  if (data.qualifications_credentials !== null && data.qualifications_credentials.length > 0) {
    score += SCORE_WEIGHTS.qualifications_non_null;
  } else {
    addFlag(flags, "CONTENT_NO_QUALIFICATIONS", "fail", "No qualifications listed");
  }

  // specialty_primary: 10 points
  if (data.specialty_primary.length > 0) {
    score += SCORE_WEIGHTS.specialty_primary_non_empty;
  }

  // insurers: 8 points
  if (data.insurers.length > 0) {
    score += SCORE_WEIGHTS.insurers_non_empty;
  } else {
    addFlag(flags, "CONTENT_NO_INSURERS", "warn", "No insurers listed");
  }

  // consultation_times_raw: 7 points
  if (data.consultation_times_raw.length > 0) {
    score += SCORE_WEIGHTS.consultation_times_non_empty;
  }

  // plain_english_score: 10 for >=4, 5 for =3, 0 for <=2
  if (data.plain_english_score !== null) {
    if (data.plain_english_score >= 4) {
      score += SCORE_WEIGHTS.plain_english_4_plus;
    } else if (data.plain_english_score === 3) {
      score += SCORE_WEIGHTS.plain_english_3;
    }
  }

  // booking_state: 10 for bookable_with_slots, 5 for bookable_no_slots, 0 for not_bookable
  if (data.booking_state === "bookable_with_slots") {
    score += SCORE_WEIGHTS.booking_with_slots;
  } else if (data.booking_state === "bookable_no_slots") {
    score += SCORE_WEIGHTS.booking_no_slots;
    addFlag(flags, "BOOKING_NO_SLOTS", "warn", "Bookable online but no available slots in next 28 days");
  } else if (data.booking_state === "not_bookable" || data.booking_state === null) {
    addFlag(flags, "BOOKING_NOT_BOOKABLE", "info", "Not bookable online");
  }

  // practising_since: 5 points
  if (data.practising_since !== null) {
    score += SCORE_WEIGHTS.practising_since_non_null;
  }

  // memberships: 5 points
  if (data.memberships.length > 0) {
    score += SCORE_WEIGHTS.memberships_non_empty;
  }

  // --- Flag generation (non-scoring flags) ---

  // QA_LOW_CONFIDENCE is handled elsewhere when extraction has low confidence

  // --- Tier determination ---

  const failFlags = flags.filter((f) => f.severity === "fail");
  const failCount = failFlags.length;

  // 2+ fail flags → forced Incomplete regardless of score
  if (failCount >= 2) {
    return {
      profile_completeness_score: score,
      quality_tier: "Incomplete",
      flags,
    };
  }

  // Check tiers from Gold down; any fail flag blocks Gold
  const hasPhoto = data.has_photo === true;
  const hasBioSubstantive = data.bio_depth === "substantive";
  const hasSpecialty = data.specialty_primary.length > 0;

  // Gold: score >= 80, has_photo, bio_depth=substantive, specialty non-empty, no fail flags
  if (
    failCount === 0 &&
    score >= TIER_THRESHOLDS.gold.minScore &&
    hasPhoto &&
    hasBioSubstantive &&
    hasSpecialty
  ) {
    return { profile_completeness_score: score, quality_tier: "Gold", flags };
  }

  // Silver: score >= 60, has_photo, specialty non-empty
  if (
    score >= TIER_THRESHOLDS.silver.minScore &&
    hasPhoto &&
    hasSpecialty
  ) {
    return { profile_completeness_score: score, quality_tier: "Silver", flags };
  }

  // Bronze: score >= 40, specialty non-empty
  if (
    score >= TIER_THRESHOLDS.bronze.minScore &&
    hasSpecialty
  ) {
    return { profile_completeness_score: score, quality_tier: "Bronze", flags };
  }

  // Incomplete: everything else
  return {
    profile_completeness_score: score,
    quality_tier: "Incomplete",
    flags,
  };
}
